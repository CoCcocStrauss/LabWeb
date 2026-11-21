const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const localEnv = path.join(root, ".env.local");
if (fs.existsSync(localEnv)) process.loadEnvFile(localEnv);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return fail("SUPABASE_URL 格式无效。");
  }
  if (parsed.protocol !== "https:") return fail("SUPABASE_URL 应使用 HTTPS。");
  if (url.includes("your-project") || key.includes("your-service")) {
    return fail("配置中仍有示例占位值。");
  }
  console.log("Supabase 配置已读取；不会输出网址、密钥或被试数据。");
  if (process.argv.includes("--config-only")) return;

  // 与应用服务端使用相同的代理设置；不修改系统代理。
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  let dispatcher;
  if (proxy) {
    dispatcher = new ProxyAgent(proxy);
    setGlobalDispatcher(dispatcher);
  }
  console.log(proxy ? "连接方式：使用当前环境的 HTTP 代理。" : "连接方式：直连。");

  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tables = ["experiments", "actions", "scroll_events", "post_visibility"];
  if (process.argv.includes("--include-questionnaires")) tables.push("experiment_sessions");
  try {
    const results = await Promise.all(tables.map(async (table) => {
      // limit=0 仅检查认证、表和读取权限，不返回已有记录，也不写入数据。
      const { error, status } = await db.from(table).select("*").limit(0)
        .abortSignal(AbortSignal.timeout(15000));
      return { table, error, status };
    }));
    for (const { table, error, status } of results) {
      if (!error) {
        console.log(`${table}: 通过（HTTP ${status}）`);
      } else {
        const code = /^[A-Z0-9_]+$/.test(error.code || "") ? error.code : "未返回错误码";
        fail(`${table}: 失败（HTTP ${status || "未收到响应"}，${code}）`);
      }
    }
    if (results.every(r => !r.error)) {
      console.log(`${tables.length} 张实验表均可读取。此检查未写入数据，未调用提交 RPC。`);
    } else if (results.some(r => !r.status)) {
      console.error("请求超时或未收到数据库响应，请检查网络、代理及项目运行状态。");
    } else if (results.some(r => [401, 403].includes(r.status))) {
      console.error("数据库返回认证或权限错误，请核对项目网址和服务端密钥是否对应。");
    } else {
      console.error("数据库已响应，请检查对应表是否已建立并对 API 开放。");
    }
  } finally {
    if (dispatcher) await dispatcher.destroy();
  }
}

main().catch(() => fail("检查未完成；请确认依赖已安装、Node.js 为 24，并检查网络连接。"));
