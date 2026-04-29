-- ========================================================
-- NEXIA MESSAGING PLATFORM - FULL DATABASE MIGRATION
-- Use este script para recriar o banco de dados em um novo projeto Supabase
-- ========================================================

-- 1. EXTENSÕES E CONFIGURAÇÕES INICIAIS
CREATE TYPE public.app_role AS ENUM ('superadmin', 'user');

-- 2. TABELAS DE USUÁRIOS E PERFIS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  last_seen_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. TABELAS DE CONFIGURAÇÃO DO SISTEMA
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Dados iniciais de sistema
INSERT INTO public.system_settings (key, value)
VALUES ('shared_evolution', '{"baseUrl":"","apiKey":"","enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. TABELAS DE INSTÂNCIAS (WHAT'SAPP)
CREATE TABLE IF NOT EXISTS public.user_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  phone TEXT,
  profile_name TEXT,
  status TEXT DEFAULT 'connecting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_name)
);

-- 5. TABELAS DE CHAT E MENSAGENS (WEBHOOK)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  profile_picture TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_name, phone_number)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  message_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  media_caption TEXT,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_conversations_instance_phone ON public.conversations(instance_name, phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_instance ON public.messages(instance_name);
CREATE INDEX IF NOT EXISTS idx_user_instances_user ON public.user_instances(user_id);

-- 7. FUNÇÕES E TRIGGERS AUTOMÁTICOS

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER system_settings_touch_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Verificação de permissões (Helper)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Criação automática de perfil no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _is_super BOOLEAN := false;
BEGIN
  -- Definir superadmin inicial (ajuste o e-mail se necessário)
  IF lower(NEW.email) = lower('bigcreditossf@gmail.com') THEN
    _is_super := true;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, trial_started_at, trial_ends_at, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    now(),
    CASE WHEN _is_super THEN now() + interval '100 years' ELSE now() + interval '3 days' END,
    true
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_super THEN 'superadmin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparada pelo Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funções Auxiliares de Instância
CREATE OR REPLACE FUNCTION register_user_instance(p_user_id UUID, p_instance_name TEXT, p_phone TEXT, p_profile_name TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_instances (user_id, instance_name, phone, profile_name, status)
  VALUES (p_user_id, p_instance_name, p_phone, p_profile_name, 'connected')
  ON CONFLICT (user_id, instance_name) DO UPDATE
  SET phone = EXCLUDED.phone, profile_name = EXCLUDED.profile_name, status = 'connected', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. POLÍTICAS DE SEGURANÇA (RLS)

-- Ativar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas existentes se necessário (Opcional)
-- DROP POLICY IF EXISTS "View own profile" ON public.profiles;

-- Perfis
CREATE POLICY "View own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Superadmin view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Superadmin manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Superadmin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Configurações de Sistema
CREATE POLICY "Superadmin manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE OR REPLACE FUNCTION public.get_shared_evolution() RETURNS JSONB AS $$ SELECT value FROM public.system_settings WHERE key = 'shared_evolution'; $$ LANGUAGE SQL STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_shared_evolution() TO authenticated;

-- Instâncias
CREATE POLICY "Manage own instances" ON public.user_instances FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Superadmin view all instances" ON public.user_instances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Conversas e Mensagens
CREATE POLICY "Auth access conversations" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth access messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

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
