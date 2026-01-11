-- Migration: Auth Hardening
-- Description: Adds role column and auto-profile trigger (UPSERT safe)

-- 1. Add role column first (Fail safe if exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
        -- Add constraint to ensure valid roles
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- 2. Create/Update Trigger Function (UPSERT Safe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    'user' -- Default role
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Only update name if it was missing or empty
    display_name = CASE 
      WHEN public.profiles.display_name IS NULL OR public.profiles.display_name = '' 
      THEN EXCLUDED.display_name 
      ELSE public.profiles.display_name 
    END,
    -- Ensure role is validated (optional, but good practice)
    updated_at = now();
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
