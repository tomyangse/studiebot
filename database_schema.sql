-- 1. Skapa profiler (Profiles) tabell kopplad till Auth
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  program_code text,
  study_year integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS för Profiles
alter table public.profiles enable row level security;
create policy "Användare kan se och uppdatera sin egen profil"
  on profiles for all
  using ( auth.uid() = id );

-- Trigger för att automatiskt skapa en profil när en ny användare registrerar sig
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Skapa tabell för Uppladdade Dokument
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  file_name text not null,
  storage_path text not null,
  file_size integer,
  subject_code text, -- e.g. "HIS"
  status text default 'uploading' check (status in ('uploading', 'analyzing', 'done', 'error')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.documents enable row level security;
create policy "Användare ser bara sina egna dokument"
  on documents for all
  using ( auth.uid() = user_id );

-- 3. Skapa tabell för AI-analysresultat
create table public.document_analysis (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  extracted_topics jsonb not null default '[]'::jsonb,
  curriculum_mapping jsonb not null default '[]'::jsonb,
  overall_coverage integer default 0,
  analyzed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.document_analysis enable row level security;
create policy "Användare ser analys kopplad till sina dokument"
  on document_analysis for select
  using ( 
    document_id in (select id from public.documents where user_id = auth.uid())
  );

-- OBS: Du behöver även skapa en Storage Bucket manuellt
-- Gå till Storage -> Create Bucket -> Döp till 'study_materials', välj Public (eller skriv skyddande policies)
