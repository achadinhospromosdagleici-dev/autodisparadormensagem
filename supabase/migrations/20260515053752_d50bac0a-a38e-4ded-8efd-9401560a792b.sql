
CREATE TABLE public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text,
  phone text NOT NULL,
  message text,
  click_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_links_user ON public.short_links(user_id);
CREATE INDEX idx_short_links_slug ON public.short_links(slug);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own short links"
  ON public.short_links FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Public read of active link by slug (needed for redirect resolution)
CREATE POLICY "Public can read active links"
  ON public.short_links FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER trg_short_links_updated
  BEFORE UPDATE ON public.short_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  ip text,
  country text,
  country_code text,
  city text,
  region text,
  device text,
  browser text,
  os text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_clicks_link ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks(clicked_at DESC);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own link clicks"
  ON public.link_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = link_clicks.link_id AND sl.user_id = auth.uid()));

-- Public insert allowed (edge function service role will do this, but allow anon as fallback)
CREATE POLICY "Anyone can insert clicks"
  ON public.link_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Function to atomically register click + return target
CREATE OR REPLACE FUNCTION public.register_link_click(
  p_slug text,
  p_ip text,
  p_country text,
  p_country_code text,
  p_city text,
  p_region text,
  p_device text,
  p_browser text,
  p_os text,
  p_referrer text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_user_agent text
)
RETURNS TABLE(phone text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
BEGIN
  SELECT id, phone, message INTO v_link
  FROM public.short_links
  WHERE slug = p_slug AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.link_clicks (
    link_id, ip, country, country_code, city, region, device, browser, os,
    referrer, utm_source, utm_medium, utm_campaign, user_agent
  ) VALUES (
    v_link.id, p_ip, p_country, p_country_code, p_city, p_region, p_device, p_browser, p_os,
    p_referrer, p_utm_source, p_utm_medium, p_utm_campaign, p_user_agent
  );

  UPDATE public.short_links SET click_count = click_count + 1 WHERE id = v_link.id;

  phone := v_link.phone;
  message := v_link.message;
  RETURN NEXT;
END;
$$;
