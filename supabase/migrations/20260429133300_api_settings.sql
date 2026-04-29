-- 9. TABELAS DE CONFIGURAÇÃO DE API (UNOAPI, EVOLUTION, ETC)

-- UnoAPI Settings
CREATE TABLE IF NOT EXISTS public.unoapi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  token TEXT NOT NULL,
  s3_enabled BOOLEAN DEFAULT false,
  s3_endpoint TEXT,
  s3_access_key TEXT,
  s3_secret_key TEXT,
  s3_bucket TEXT,
  s3_region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.unoapi_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unoapi settings"
ON public.unoapi_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own unoapi settings"
ON public.unoapi_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Evolution API Settings
CREATE TABLE IF NOT EXISTS public.evolution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.evolution_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution settings"
ON public.evolution_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own evolution settings"
ON public.evolution_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Evolution Go Settings
CREATE TABLE IF NOT EXISTS public.evolution_go_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.evolution_go_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution go settings"
ON public.evolution_go_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own evolution go settings"
ON public.evolution_go_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Chatwoot Settings
CREATE TABLE IF NOT EXISTS public.chatwoot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.chatwoot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chatwoot settings"
ON public.chatwoot_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own chatwoot settings"
ON public.chatwoot_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- AI Settings
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai settings"
ON public.ai_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own ai settings"
ON public.ai_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Triggers para Updated At
CREATE OR REPLACE FUNCTION public.touch_api_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER unoapi_settings_touch_updated_at
BEFORE UPDATE ON public.unoapi_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

CREATE TRIGGER evolution_settings_touch_updated_at
BEFORE UPDATE ON public.evolution_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

CREATE TRIGGER evolution_go_settings_touch_updated_at
BEFORE UPDATE ON public.evolution_go_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

CREATE TRIGGER chatwoot_settings_touch_updated_at
BEFORE UPDATE ON public.chatwoot_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

CREATE TRIGGER ai_settings_touch_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();
