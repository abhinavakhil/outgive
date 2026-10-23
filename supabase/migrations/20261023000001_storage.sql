-- Public media bucket for logos and covers. Skipped where there is no storage schema (PGlite tests and the browser demo).
do $$ begin
    if exists (select 1 from pg_namespace where nspname = 'storage') then
        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media', 'media', true, 52428800, '{image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime}') on conflict (id) do nothing;
        execute 'create policy "media is public" on storage.objects for select using (bucket_id = ''media'')';
        execute 'create policy "signed-in users upload media" on storage.objects for insert to authenticated with check (bucket_id = ''media'')';
        execute 'create policy "owners replace their media" on storage.objects for update to authenticated using (bucket_id = ''media'' and owner = auth.uid())';
    end if;
end $$;
