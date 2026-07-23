-- Label photo path + discovery fields (run in Supabase SQL Editor)

alter table public.wines
  add column if not exists label_image_url text,
  add column if not exists kimi_curiosity text,
  add column if not exists kimi_talk_hook text;

-- Private bucket for user-scanned labels (path: {user_id}/{wine_id}.jpg)
insert into storage.buckets (id, name, public)
values ('wine-labels', 'wine-labels', false)
on conflict (id) do nothing;

drop policy if exists "wine_labels_select_own" on storage.objects;
create policy "wine_labels_select_own"
  on storage.objects for select
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_insert_own" on storage.objects;
create policy "wine_labels_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_update_own" on storage.objects;
create policy "wine_labels_update_own"
  on storage.objects for update
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_delete_own" on storage.objects;
create policy "wine_labels_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
