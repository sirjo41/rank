/*
  # Robotics Competition Database Schema

  1. New Tables
    - `teams`
      - `id` (uuid, primary key) - Unique identifier for each team
      - `name` (text, unique, not null) - Team name
      - `created_at` (timestamptz) - Timestamp when team was added
    
    - `matches`
      - `id` (uuid, primary key) - Unique identifier for each match
      - `team1_id` (uuid, foreign key) - First team in alliance 1
      - `team2_id` (uuid, foreign key) - Second team in alliance 1
      - `team3_id` (uuid, foreign key) - First team in alliance 2
      - `team4_id` (uuid, foreign key) - Second team in alliance 2
      - `score1` (integer, nullable) - Score for alliance 1 (team1 + team2)
      - `score2` (integer, nullable) - Score for alliance 2 (team3 + team4)
      - `created_at` (timestamptz) - Timestamp when match was created
  
  2. Security
    - Enable RLS on both tables
    - Add policies for public access (since this is a competition app)
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team1_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team2_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team3_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team4_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  score1 integer DEFAULT NULL,
  score2 integer DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to teams"
  ON teams FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to teams"
  ON teams FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public read access to matches"
  ON matches FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to matches"
  ON matches FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to matches"
  ON matches FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);