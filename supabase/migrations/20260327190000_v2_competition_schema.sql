/*
  UniBotics Competition Manager - Schema V2
  
  Complete rebuild for multi-role dashboard system.
  Drops old tables and recreates with:
  - users (auth)
  - teams
  - matches (FTC-style scoring with Auto/TeleOp/Fouls, 1v1 & 2v2)
  - competition_settings (audience view control)
*/

-- Drop old tables
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'judge')),
  created_at timestamptz DEFAULT now()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  team_number integer,
  created_at timestamptz DEFAULT now()
);

-- Matches table with full FTC-style scoring
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number integer NOT NULL,
  match_type text NOT NULL DEFAULT '2v2' CHECK (match_type IN ('1v1', '2v2')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'playing', 'judge_submitted', 'completed')),

  -- Red Alliance teams
  red_team1_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  red_team2_id uuid REFERENCES teams(id) ON DELETE CASCADE,

  -- Blue Alliance teams
  blue_team1_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  blue_team2_id uuid REFERENCES teams(id) ON DELETE CASCADE,

  -- Red Alliance scoring
  score_auto_red integer DEFAULT 0,
  score_teleop_red integer DEFAULT 0,
  fouls_minor_red integer DEFAULT 0,
  fouls_major_red integer DEFAULT 0,

  -- Blue Alliance scoring
  score_auto_blue integer DEFAULT 0,
  score_teleop_blue integer DEFAULT 0,
  fouls_minor_blue integer DEFAULT 0,
  fouls_major_blue integer DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

-- Competition settings (singleton row)
CREATE TABLE IF NOT EXISTS competition_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  audience_view text NOT NULL DEFAULT 'standby' CHECK (audience_view IN ('standby', 'match', 'rankings', 'results')),
  timer_running boolean DEFAULT false,
  timer_started_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row
INSERT INTO competition_settings (id, audience_view) VALUES (1, 'standby')
ON CONFLICT (id) DO NOTHING;

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_settings ENABLE ROW LEVEL SECURITY;

-- Users: read/write via server only (service key or anon for login)
CREATE POLICY "Allow public read users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert users" ON users FOR INSERT TO anon WITH CHECK (true);

-- Teams: full public access
CREATE POLICY "Allow public read teams" ON teams FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert teams" ON teams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public delete teams" ON teams FOR DELETE TO anon USING (true);

-- Matches: full public access
CREATE POLICY "Allow public read matches" ON matches FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert matches" ON matches FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update matches" ON matches FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete matches" ON matches FOR DELETE TO anon USING (true);

-- Competition settings: full public access
CREATE POLICY "Allow public read settings" ON competition_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert settings" ON competition_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON competition_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
