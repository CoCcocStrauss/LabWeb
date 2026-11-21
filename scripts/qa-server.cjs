// 隔离验收：内存PostgreSQL与私有音频适配；不读取.env.local，不连接远程。
const http = require('node:http');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const {PGlite} = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const {root} = require('./test-support.cjs');
async function main() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(readFileSync(`${root}/supabase/schema.sql`,'utf8'));
  const files = new Map(), tokens = new Map(); let failNext = null;
  const server = http.createServer(async (req,res) => {
    const url = new URL(req.url,'http://127.0.0.1:3211');
    const headers = {'Cache-Control':'no-store','Access-Control-Allow-Origin':'http://127.0.0.1:3210','Access-Control-Allow-Methods':'POST,GET,PUT,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-upsert,x-client-info'};
    const send = (status,body) => {res.writeHead(status,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    const raw = async () => {const chunks=[];for await(const c of req) chunks.push(c);return Buffer.concat(chunks);};
    try {
      if(req.method==='OPTIONS') {res.writeHead(204,headers);return res.end();}
      if(url.pathname==='/_qa/fail-next') {failNext=url.searchParams.get('phase')||'submit_experiment_v3';return send(200,{armed:failNext});}
      if(url.pathname==='/_qa/state') {
        const uid=url.searchParams.get('uid');
        const session=(await db.query('select * from experiment_sessions where uid=$1',[uid])).rows[0]??null;
        if(session) delete session.session_secret_hash;
        const experiment=(await db.query('select * from experiments where uid=$1',[uid])).rows[0]??null;
        const counts={};for(const table of ['actions','scroll_events','post_visibility','experiment_audio']) counts[table]=(await db.query(`select count(*)::int as n from ${table} where uid=$1`,[uid])).rows[0].n;
        const audio=(await db.query('select recording_id,verified,byte_length,mime_type from experiment_audio where uid=$1',[uid])).rows;
        return send(200,{session,experiment,counts,audio});
      }
      if(['/rest/v1/experiments','/rest/v1/experiment_sessions'].includes(url.pathname)) {
        const uid=(url.searchParams.get('uid')||'').replace(/^eq\./,'');
        const table=url.pathname.split('/').at(-1);
        return send(200,(await db.query(`select * from ${table} where uid=$1`,[uid])).rows);
      }
      if(url.pathname.startsWith('/storage/v1/')) {
        const route=decodeURIComponent(url.pathname.slice('/storage/v1/'.length));
        if(route==='bucket/experiment-audio' && req.headers.authorization==='Bearer local-qa-only') return send(200,{id:'experiment-audio',name:'experiment-audio',public:false,file_size_limit:20971520});
        const signed='object/upload/sign/experiment-audio/';
        if(route.startsWith(signed)) {
          const path=route.slice(signed.length);
          if(req.method==='POST' && req.headers.authorization==='Bearer local-qa-only') {
            const token=randomUUID();tokens.set(token,path);return send(200,{url:`/object/upload/sign/experiment-audio/${path}?token=${token}`});
          }
          if(req.method==='PUT' && tokens.get(url.searchParams.get('token'))===path) {
            if(failNext==='audio_put') {failNext=null;return send(503,{error:'QA upload unavailable'});}
            if(files.has(path)) return send(400,{statusCode:'409',error:'Duplicate'});
            files.set(path,{bytes:await raw(),mime:req.headers['content-type']});
            if(failNext==='audio_put_after_commit') {failNext=null;return send(503,{error:'QA response lost'});}
            return send(200,{Key:path});
          }
        }
        if(req.headers.authorization!=='Bearer local-qa-only') return send(403,{error:'Private object'});
        const info='object/info/experiment-audio/', download='object/experiment-audio/';
        if(route.startsWith(info)) {
          const file=files.get(route.slice(info.length));if(!file)return send(404,{});
          return send(200,{size:file.bytes.length,content_type:file.mime,metadata:{size:file.bytes.length,mimetype:file.mime}});
        }
        if(route.startsWith(download)) {
          const file=files.get(route.slice(download.length));if(!file)return send(404,{});
          res.writeHead(200,{...headers,'Content-Type':file.mime});return res.end(file.bytes);
        }
        return send(404,{});
      }
      if(req.method!=='POST') return send(404,{});
      const p=JSON.parse((await raw()).toString()), name=url.pathname.split('/').at(-1);let result=null;
      const pre=[p.p_uid,p.p_session_id,p.p_condition_n,p.p_topic_key,p.p_questionnaire_version,JSON.stringify(p.p_pretest)];
      if(name==='save_experiment_pretest') await db.query('select save_experiment_pretest($1,$2,$3,$4,$5,$6::jsonb)',pre);
      else if(name==='save_experiment_pretest_v3') await db.query('select save_experiment_pretest_v3($1,$2,$3,$4,$5,$6::jsonb,$7)',[...pre,p.p_secret_hash]);
      else if(name==='submit_experiment_v2'||name==='submit_experiment_v3') {
        const args=[JSON.stringify(p.p_payload),p.p_payload_hash,p.p_completion_code];if(name.endsWith('v3'))args.push(p.p_secret_hash);
        result=(await db.query(`select ${name}($1::jsonb,$2,$3${name.endsWith('v3')?',$4':''}) as code`,args)).rows[0].code;
      } else if(name==='prepare_experiment_audio') result=(await db.query('select prepare_experiment_audio($1,$2,$3,$4,$5,$6,$7,$8,$9) as ready',[p.p_uid,p.p_session_id,p.p_secret_hash,p.p_recording_id,p.p_storage_path,p.p_mime_type,p.p_byte_length,p.p_duration_ms,p.p_sha256])).rows[0].ready;
      else if(name==='confirm_experiment_audio') await db.query('select confirm_experiment_audio($1,$2,$3,$4)',[p.p_uid,p.p_session_id,p.p_secret_hash,p.p_recording_id]);
      else return send(404,{code:'42883'});
      if(failNext===name) {failNext=null;return send(500,{code:'XX000',message:'QA response loss after commit'});}
      return send(200,result);
    } catch(e) {return send(e.code==='23505'?409:400,{code:e.code||'XX000',message:'Local QA request rejected'});}
  });
  server.listen(3211,'127.0.0.1',()=>console.log('Isolated QA database/audio ready on 3211 (memory only)'));
  const stop=()=>server.close(async()=>{await db.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
