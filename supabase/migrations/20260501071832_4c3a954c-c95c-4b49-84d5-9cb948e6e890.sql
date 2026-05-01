CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

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

CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE TABLE IF NOT EXISTS public.phone_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_phone TEXT NOT NULL,
  mapped_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_phone)
);

CREATE TABLE IF NOT EXISTS public.user_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  phone TEXT,
  profile_name TEXT,
  status TEXT NOT NULL DEFAULT 'connecting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instance_name)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  profile_picture TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_name, phone_number)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  message_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  media_caption TEXT,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON public.user_settings(user_id, key);
CREATE INDEX IF NOT EXISTS idx_user_instances_user ON public.user_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_instances_instance_name ON public.user_instances(instance_name);
CREATE INDEX IF NOT EXISTS idx_conversations_instance_phone ON public.conversations(instance_name, phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_instance ON public.messages(instance_name);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unoapi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_go_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatwoot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user settings" ON public.user_settings;
CREATE POLICY "Users can view own user settings"
ON public.user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own user settings" ON public.user_settings;
CREATE POLICY "Users can manage own user settings"
ON public.user_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own unoapi settings" ON public.unoapi_settings;
CREATE POLICY "Users can view own unoapi settings"
ON public.unoapi_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own unoapi settings" ON public.unoapi_settings;
CREATE POLICY "Users can manage own unoapi settings"
ON public.unoapi_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own evolution settings" ON public.evolution_settings;
CREATE POLICY "Users can view own evolution settings"
ON public.evolution_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own evolution settings" ON public.evolution_settings;
CREATE POLICY "Users can manage own evolution settings"
ON public.evolution_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own evolution go settings" ON public.evolution_go_settings;
CREATE POLICY "Users can view own evolution go settings"
ON public.evolution_go_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own evolution go settings" ON public.evolution_go_settings;
CREATE POLICY "Users can manage own evolution go settings"
ON public.evolution_go_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own chatwoot settings" ON public.chatwoot_settings;
CREATE POLICY "Users can view own chatwoot settings"
ON public.chatwoot_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own chatwoot settings" ON public.chatwoot_settings;
CREATE POLICY "Users can manage own chatwoot settings"
ON public.chatwoot_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own ai settings" ON public.ai_settings;
CREATE POLICY "Users can view own ai settings"
ON public.ai_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own ai settings" ON public.ai_settings;
CREATE POLICY "Users can manage own ai settings"
ON public.ai_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own templates" ON public.message_templates;
CREATE POLICY "Users can view own templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own templates" ON public.message_templates;
CREATE POLICY "Users can manage own templates"
ON public.message_templates FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own blacklist" ON public.blacklist;
CREATE POLICY "Users can view own blacklist"
ON public.blacklist FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own blacklist" ON public.blacklist;
CREATE POLICY "Users can manage own blacklist"
ON public.blacklist FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own mappings" ON public.phone_mappings;
CREATE POLICY "Users can view own mappings"
ON public.phone_mappings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own mappings" ON public.phone_mappings;
CREATE POLICY "Users can manage own mappings"
ON public.phone_mappings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own instances" ON public.user_instances;
CREATE POLICY "Users can manage own instances"
ON public.user_instances FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Superadmin view all instances" ON public.user_instances;
CREATE POLICY "Superadmin view all instances"
ON public.user_instances FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Users can view conversations for owned instances" ON public.conversations;
CREATE POLICY "Users can view conversations for owned instances"
ON public.conversations FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR EXISTS (
    SELECT 1
    FROM public.user_instances ui
    WHERE ui.user_id = auth.uid()
      AND ui.instance_name = conversations.instance_name
  )
);

DROP POLICY IF EXISTS "Users can update conversations for owned instances" ON public.conversations;
CREATE POLICY "Users can update conversations for owned instances"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR EXISTS (
    SELECT 1
    FROM public.user_instances ui
    WHERE ui.user_id = auth.uid()
      AND ui.instance_name = conversations.instance_name
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR EXISTS (
    SELECT 1
    FROM public.user_instances ui
    WHERE ui.user_id = auth.uid()
      AND ui.instance_name = conversations.instance_name
  )
);

DROP POLICY IF EXISTS "Service role can manage conversations" ON public.conversations;
CREATE POLICY "Service role can manage conversations"
ON public.conversations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view messages for owned instances" ON public.messages;
CREATE POLICY "Users can view messages for owned instances"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR EXISTS (
    SELECT 1
    FROM public.user_instances ui
    WHERE ui.user_id = auth.uid()
      AND ui.instance_name = messages.instance_name
  )
);

DROP POLICY IF EXISTS "Service role can manage messages" ON public.messages;
CREATE POLICY "Service role can manage messages"
ON public.messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

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

DROP TRIGGER IF EXISTS user_settings_touch_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_touch_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS unoapi_settings_touch_updated_at ON public.unoapi_settings;
CREATE TRIGGER unoapi_settings_touch_updated_at
BEFORE UPDATE ON public.unoapi_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS evolution_settings_touch_updated_at ON public.evolution_settings;
CREATE TRIGGER evolution_settings_touch_updated_at
BEFORE UPDATE ON public.evolution_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS evolution_go_settings_touch_updated_at ON public.evolution_go_settings;
CREATE TRIGGER evolution_go_settings_touch_updated_at
BEFORE UPDATE ON public.evolution_go_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS chatwoot_settings_touch_updated_at ON public.chatwoot_settings;
CREATE TRIGGER chatwoot_settings_touch_updated_at
BEFORE UPDATE ON public.chatwoot_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS ai_settings_touch_updated_at ON public.ai_settings;
CREATE TRIGGER ai_settings_touch_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS message_templates_touch_updated_at ON public.message_templates;
CREATE TRIGGER message_templates_touch_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS user_instances_touch_updated_at ON public.user_instances;
CREATE TRIGGER user_instances_touch_updated_at
BEFORE UPDATE ON public.user_instances
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

DROP TRIGGER IF EXISTS conversations_touch_updated_at ON public.conversations;
CREATE TRIGGER conversations_touch_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

CREATE OR REPLACE FUNCTION public.register_user_instance(
  p_user_id UUID,
  p_instance_name TEXT,
  p_phone TEXT,
  p_profile_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_instances (user_id, instance_name, phone, profile_name, status)
  VALUES (p_user_id, p_instance_name, p_phone, p_profile_name, 'connected')
  ON CONFLICT (user_id, instance_name) DO UPDATE
  SET phone = EXCLUDED.phone,
      profile_name = EXCLUDED.profile_name,
      status = 'connected',
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user_instance(UUID, TEXT, TEXT, TEXT) TO authenticated;

INSERT INTO public.system_settings (key, value)
VALUES ('unoapi', '{"baseUrl":"","token":"","enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;