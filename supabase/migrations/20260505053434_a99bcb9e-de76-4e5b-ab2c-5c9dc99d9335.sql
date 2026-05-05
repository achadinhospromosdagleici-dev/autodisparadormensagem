CREATE TABLE public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('audio','sticker','image')),
  url TEXT NOT NULL,
  filename TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_library_user_type ON public.media_library(user_id, media_type, created_at DESC);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media"
ON public.media_library FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media"
ON public.media_library FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media"
ON public.media_library FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
ON public.media_library FOR DELETE
USING (auth.uid() = user_id);