-- Migration for Public Live View Feature
-- Run this in your Supabase SQL Editor

-- 1. Add columns for sharing functionality
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS share_code text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS share_code_created_at timestamptz;

-- 2. Add unique index for share_code to facilitate fast lookups
-- Using IF NOT EXISTS via do block or just simple creation (might fail if exists, user should handle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_share_code ON tournaments(share_code);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_public ON tournaments(is_public);

-- 3. Row Level Security (RLS) Policies for Public Access
-- These policies allow anonymous users to READ data if the tournament is marked as public.

-- Enable RLS (just in case)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policy for Tournaments
-- Drop existing if conflict (cleaner to just create new with unique name)
DROP POLICY IF EXISTS "Public tournaments are viewable by everyone" ON tournaments;
CREATE POLICY "Public tournaments are viewable by everyone" 
ON tournaments FOR SELECT 
TO anon, authenticated
USING (is_public = true);

-- Policy for Teams
-- Viewable if the parent tournament is public
DROP POLICY IF EXISTS "Teams of public tournaments are viewable" ON teams;
CREATE POLICY "Teams of public tournaments are viewable" 
ON teams FOR SELECT 
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE id = teams.tournament_id 
    AND is_public = true
  )
);

-- Policy for Matches
-- Viewable if the parent tournament is public
DROP POLICY IF EXISTS "Matches of public tournaments are viewable" ON matches;
CREATE POLICY "Matches of public tournaments are viewable" 
ON matches FOR SELECT 
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE id = matches.tournament_id 
    AND is_public = true
  )
);
