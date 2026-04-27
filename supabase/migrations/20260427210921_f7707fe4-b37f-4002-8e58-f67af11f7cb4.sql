update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png','image/jpeg']
where id = 'listing-images';

alter table public.draft_listings
  add column if not exists image_url text;