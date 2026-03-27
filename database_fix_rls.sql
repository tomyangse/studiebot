-- ============================================================
-- Fix RLS policies for DELETE operations
-- Run this in Supabase SQL Editor
-- ============================================================

-- document_analysis: Allow users to delete their own analysis records
-- (Currently only SELECT is allowed, which blocks delete)
create policy "Users delete own analysis"
  on document_analysis for delete
  using (
    document_id in (select id from public.documents where user_id = auth.uid())
  );

-- Also add INSERT/UPDATE for document_analysis (needed for future features)
create policy "Users insert own analysis"
  on document_analysis for insert
  with check (
    document_id in (select id from public.documents where user_id = auth.uid())
  );

-- flashcard_decks: Ensure DELETE policy exists (the 'for all' should cover it, but let's be explicit)
-- Already has: "Users manage own decks" for all using (auth.uid() = user_id)
-- This should work. If not, uncomment below:
-- create policy "Users delete own decks"
--   on flashcard_decks for delete
--   using ( auth.uid() = user_id );

-- flashcards: Add DELETE policy
create policy "Users delete cards from own decks"
  on flashcards for delete
  using (
    deck_id in (select id from public.flashcard_decks where user_id = auth.uid())
  );

-- flashcard_reviews: Add DELETE policy  
create policy "Users delete own reviews"
  on flashcard_reviews for delete
  using ( auth.uid() = user_id );

-- Storage: Allow users to delete their own files
-- Run this if storage delete doesn't work:
-- Go to Storage -> Policies -> study_materials bucket
-- Add a DELETE policy: (auth.uid()::text = (storage.foldername(name))[1])
