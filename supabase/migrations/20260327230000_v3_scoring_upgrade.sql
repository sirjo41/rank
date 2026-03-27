/*
  UniBotics - Schema V3: Shape-Based Scoring System + Judge Types
  
  Run this in Supabase SQL Editor (after v2 migration).
  Adds:
  - score_breakdown JSONB columns to matches (replaces old auto/teleop columns)
  - judge_type to users
*/

-- Add shape-based scoring breakdown columns
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS score_breakdown_red JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_breakdown_blue JSONB DEFAULT '{}'::jsonb;

-- Drop old simple score columns (now computed from breakdown)
ALTER TABLE matches
  DROP COLUMN IF EXISTS score_auto_red,
  DROP COLUMN IF EXISTS score_teleop_red,
  DROP COLUMN IF EXISTS score_auto_blue,
  DROP COLUMN IF EXISTS score_teleop_blue;

-- Add judge_type to users ('red' judge controls red alliance, 'blue' controls blue)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS judge_type text CHECK (judge_type IN ('red', 'blue'));

-- Ensure update policy exists for users table (admin manages judges)
DROP POLICY IF EXISTS "Allow public update users" ON users;
CREATE POLICY "Allow public update users" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete users" ON users;
CREATE POLICY "Allow public delete users" ON users FOR DELETE TO anon USING (true);
