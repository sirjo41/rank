ALTER TABLE public.competition_settings ADD COLUMN IF NOT EXISTS timer_running boolean DEFAULT false;
ALTER TABLE public.competition_settings ADD COLUMN IF NOT EXISTS timer_started_at timestamp with time zone;
ALTER TABLE public.competition_settings ADD COLUMN IF NOT EXISTS timer_paused_remaining integer;

-- Also ensure the realtime publication includes the settings table so websockets work perfectly if they missed it:
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE competition_settings;
