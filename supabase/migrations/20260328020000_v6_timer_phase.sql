-- Add timer_phase column to competition_settings
ALTER TABLE competition_settings ADD COLUMN timer_phase TEXT DEFAULT 'none';

-- Update handle_timer_running trigger if it exists, or just ensure default
-- Actually, we'll handle setting 'none' when resetting match.
