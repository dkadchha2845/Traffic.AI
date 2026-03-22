-- Make user_id optional in signal_logs so the backend can write anonymous or system operator commands
-- without violating the NOT NULL constraint or needing a fake UUID.

ALTER TABLE public.signal_logs ALTER COLUMN user_id DROP NOT NULL;
