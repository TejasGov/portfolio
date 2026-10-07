-- Run once in a Supabase project's SQL editor (PostgreSQL 15+).
-- Anonymous visitors can read and append reviews, never update/delete them.
begin;

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (project_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  author text not null default 'Guest' check (char_length(author) between 1 and 60 and author = btrim(author) and author ~ '[^[:space:]]'),
  body text not null default '' check (char_length(body) <= 2000 and body = btrim(body)),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint review_has_content check (body ~ '[^[:space:]]' or rating is not null)
);

create index project_reviews_project_date_idx on public.project_reviews (project_id, created_at desc, id desc);
alter table public.project_reviews enable row level security;

revoke all on public.project_reviews from anon, authenticated;
grant select on public.project_reviews to anon, authenticated;
-- Server-generated IDs and timestamps cannot be forged by browser clients.
grant insert (project_id, author, body, rating) on public.project_reviews to anon, authenticated;
create policy "Public can read project reviews" on public.project_reviews
  for select to anon, authenticated using (true);
create policy "Public can submit project reviews" on public.project_reviews
  for insert to anon, authenticated with check (true);

-- Aggregates cover every rating, independently of the UI's paginated reviews.
create view public.project_review_stats with (security_invoker = true) as
  select project_id, avg(rating)::numeric(3,2) as average_rating,
    count(rating) as rating_count, count(*) as review_count
  from public.project_reviews group by project_id;
grant select on public.project_review_stats to anon, authenticated;

commit;
notify pgrst, 'reload schema';
