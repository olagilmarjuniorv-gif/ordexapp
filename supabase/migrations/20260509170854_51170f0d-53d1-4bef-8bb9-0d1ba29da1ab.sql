-- Add username column to profiles for username-based login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Backfill existing profiles with username derived from auth email local-part
UPDATE public.profiles p
SET username = lower(split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL AND u.email IS NOT NULL;
