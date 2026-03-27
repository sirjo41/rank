-- Add Judge Ready flags to the matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS judge_red_ready boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS judge_blue_ready boolean DEFAULT false;

-- Add the new head_referee role to the active users constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'judge', 'head_referee'));
