-- Create public bucket for campaign media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-media', 'campaign-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read campaign-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-media');

-- Anyone (incl. anon) can upload to campaign-media
CREATE POLICY "Anyone can upload campaign-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-media');

-- Anyone can update/delete (simple app, no auth required for media)
CREATE POLICY "Anyone can update campaign-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'campaign-media');

CREATE POLICY "Anyone can delete campaign-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-media');