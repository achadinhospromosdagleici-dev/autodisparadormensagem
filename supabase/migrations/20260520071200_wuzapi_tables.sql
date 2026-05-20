-- Create table wuzapi_settings
CREATE TABLE IF NOT EXISTS public.wuzapi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url VARCHAR(255) NOT NULL DEFAULT 'https://wuzapi.bigcreditos.com.br',
  admin_token VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.wuzapi_settings ENABLE ROW LEVEL SECURITY;

-- Policies for wuzapi_settings
CREATE POLICY "Users can view own wuzapi settings"
ON public.wuzapi_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own wuzapi settings"
ON public.wuzapi_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Trigger for Updated At
CREATE TRIGGER wuzapi_settings_touch_updated_at
BEFORE UPDATE ON public.wuzapi_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

-- Create table wuzapi_instances
CREATE TABLE IF NOT EXISTS public.wuzapi_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_id UUID REFERENCES public.wuzapi_settings(id) ON DELETE CASCADE,
  user_token VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(settings_id, user_token)
);

-- Enable RLS
ALTER TABLE public.wuzapi_instances ENABLE ROW LEVEL SECURITY;

-- Policies for wuzapi_instances
CREATE POLICY "Users can view own wuzapi instances"
ON public.wuzapi_instances FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own wuzapi instances"
ON public.wuzapi_instances FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add source column to user_instances if not present
ALTER TABLE public.user_instances ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'unoapi';

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_wuzapi_instances_user ON public.wuzapi_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_wuzapi_instances_settings ON public.wuzapi_instances(settings_id);
CREATE INDEX IF NOT EXISTS idx_user_instances_source ON public.user_instances(source);
