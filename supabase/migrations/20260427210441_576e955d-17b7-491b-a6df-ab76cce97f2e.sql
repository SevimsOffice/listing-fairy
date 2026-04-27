insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', false)
on conflict (id) do nothing;

create policy "Users read own listing images"
on storage.objects for select
to authenticated
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own listing images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own listing images"
on storage.objects for update
to authenticated
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own listing images"
on storage.objects for delete
to authenticated
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);