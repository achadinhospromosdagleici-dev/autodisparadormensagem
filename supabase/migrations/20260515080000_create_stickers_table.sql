
-- Migration to create stickers table for the sticker gallery
CREATE TABLE IF NOT EXISTS public.stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stickers' AND policyname = 'Users manage own stickers'
  ) THEN
    CREATE POLICY "Users manage own stickers" ON public.stickers 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()) 
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
