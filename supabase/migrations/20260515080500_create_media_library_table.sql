
-- Migration to create media_library table for the gallery (stickers and audios)
CREATE TABLE IF NOT EXISTS public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('audio', 'sticker', 'image', 'video', 'document')),
  url text NOT NULL,
  filename text,
  duration_seconds integer,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'media_library' AND policyname = 'Users manage own media library'
  ) THEN
    CREATE POLICY "Users manage own media library" ON public.media_library 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()) 
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
