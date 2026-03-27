-- ============================================================
-- StudieMate SRS Schema v2
-- Flashcard Decks, Cards, and Review Tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Flashcard Decks (one per document extraction)
create table if not exists public.flashcard_decks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade,
  title text not null,
  total_cards integer default 0,
  status text default 'generating' check (status in ('generating', 'ready', 'error')),
  created_at timestamptz default now()
);

alter table public.flashcard_decks enable row level security;
create policy "Users manage own decks"
  on flashcard_decks for all
  using ( auth.uid() = user_id );

-- 2. Individual Flashcards
create table if not exists public.flashcards (
  id uuid default gen_random_uuid() primary key,
  deck_id uuid references public.flashcard_decks(id) on delete cascade not null,
  front text not null,
  back text not null,
  card_type text default 'concept',
  grade_level text default 'E',
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.flashcards enable row level security;
create policy "Users read cards from own decks"
  on flashcards for select
  using (
    deck_id in (select id from public.flashcard_decks where user_id = auth.uid())
  );
create policy "Users insert cards into own decks"
  on flashcards for insert
  with check (
    deck_id in (select id from public.flashcard_decks where user_id = auth.uid())
  );

-- 3. Review Records (SRS core)
create table if not exists public.flashcard_reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_id uuid references public.flashcards(id) on delete cascade not null,
  rating text not null check (rating in ('hard', 'ok', 'easy')),
  ease_factor real default 2.5,
  interval_days integer default 0,
  next_review_at timestamptz default now(),
  reviewed_at timestamptz default now()
);

alter table public.flashcard_reviews enable row level security;
create policy "Users manage own reviews"
  on flashcard_reviews for all
  using ( auth.uid() = user_id );

-- 4. Helper: Get the latest review for each card (used by the app)
create or replace view public.card_latest_reviews as
select distinct on (card_id)
  card_id,
  user_id,
  rating,
  ease_factor,
  interval_days,
  next_review_at,
  reviewed_at
from public.flashcard_reviews
order by card_id, reviewed_at desc;
