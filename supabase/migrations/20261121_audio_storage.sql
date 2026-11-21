-- 仅在Supabase项目中执行；先执行前两份应用表迁移。未自动执行线上配置。
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('experiment-audio','experiment-audio',false,20971520,array['audio/webm','audio/mp4','audio/ogg'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='experiment-audio' and public) then
    raise exception 'experiment-audio must be private; review existing bucket configuration';
  end if;
end $$;
-- 即使项目已有宽泛的对象读取policy，也禁止anon/authenticated访问研究录音。
drop policy if exists labweb_audio_private on storage.objects;
create policy labweb_audio_private on storage.objects as restrictive for all to anon,authenticated
  using (bucket_id <> 'experiment-audio') with check (bucket_id <> 'experiment-audio');
commit;
