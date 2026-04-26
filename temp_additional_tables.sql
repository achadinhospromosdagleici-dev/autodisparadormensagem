-- Tabelas para migração de localStorage para Supabase

-- message_templates (MessageTemplates.tsx)
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own templates"
ON public.message_templates FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- blacklist (BlacklistManager.tsx)
CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blacklist"
ON public.blacklist FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own blacklist"
ON public.blacklist FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- phone_mappings (mappingStorage.ts)
CREATE TABLE IF NOT EXISTS public.phone_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_phone TEXT NOT NULL,
  mapped_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_phone)
);

ALTER TABLE public.phone_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mappings"
ON public.phone_mappings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own mappings"
ON public.phone_mappings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Triggers touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_user_data_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_templates_touch_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();

-- Habilitar Shared Evolution para Trial users (se não existir)
INSERT INTO public.system_settings (key, value) 
VALUES ('shared_evolution', '{"baseUrl":"","apiKey":"","enabled":false}')
ON CONFLICT (key) DO NOTHING;

-- Habilitar UnoAPI no user_settings
INSERT INTO public.system_settings (key, value) 
VALUES ('unoapi', '{"baseUrl":"","token":"","enabled":false}')
ON CONFLICT (key) DO NOTHING;