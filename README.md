# Remix of Message Flow

Plataforma de disparo em massa de mensagens WhatsApp via múltiplas APIs (UnoAPI, Evolution, Evolution Go, WuzAPI, Chatwoot).

---

## Sumário

1. [Pré-requisitos](#pré-requisitos)
2. [Supabase — SQL Editor](#supabase--sql-editor)
3. [Supabase — Edge Functions](#supabase--edge-functions)
4. [Vercel — Variáveis de Ambiente](#vercel--variáveis-de-ambiente)
5. [Deploy na Vercel](#deploy-na-vercel)
6. [Configuração Inicial](#configuração-inicial)

---

## Pré-requisitos

- Node.js 18+
- Conta [Supabase](https://supabase.com) (plana free)
- Conta [Vercel](https://vercel.com) (plana free)
- Supabase CLI (`npm install -g supabase` ou `npx supabase`)

---

## Supabase — SQL Editor

Acesse o dashboard do Supabase → **SQL Editor** → **New Query** e cole o bloco abaixo:

```sql
-- ============================================================
-- 1. FUNÇÃO TRIGGER PARA updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_api_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. TABELAS DE CONFIGURAÇÃO DE API
-- ============================================================

-- UnoAPI
CREATE TABLE IF NOT EXISTS public.unoapi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  token TEXT NOT NULL,
  s3_enabled BOOLEAN DEFAULT false,
  s3_endpoint TEXT, s3_access_key TEXT, s3_secret_key TEXT, s3_bucket TEXT, s3_region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.unoapi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own unoapi settings" ON public.unoapi_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own unoapi settings" ON public.unoapi_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Evolution API
CREATE TABLE IF NOT EXISTS public.evolution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL, api_key TEXT NOT NULL, instance_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.evolution_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evolution settings" ON public.evolution_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own evolution settings" ON public.evolution_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Evolution Go
CREATE TABLE IF NOT EXISTS public.evolution_go_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL, api_key TEXT NOT NULL, instance_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.evolution_go_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evolution go settings" ON public.evolution_go_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own evolution go settings" ON public.evolution_go_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Chatwoot
CREATE TABLE IF NOT EXISTS public.chatwoot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL, api_token TEXT NOT NULL, account_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.chatwoot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chatwoot settings" ON public.chatwoot_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own chatwoot settings" ON public.chatwoot_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI Gateway
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, api_key TEXT NOT NULL, model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ai settings" ON public.ai_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own ai settings" ON public.ai_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Triggers updated_at
CREATE TRIGGER unoapi_settings_touch_updated_at BEFORE UPDATE ON public.unoapi_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();
CREATE TRIGGER evolution_settings_touch_updated_at BEFORE UPDATE ON public.evolution_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();
CREATE TRIGGER evolution_go_settings_touch_updated_at BEFORE UPDATE ON public.evolution_go_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();
CREATE TRIGGER chatwoot_settings_touch_updated_at BEFORE UPDATE ON public.chatwoot_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();
CREATE TRIGGER ai_settings_touch_updated_at BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

-- ============================================================
-- 3. user_instances (catálogo centralizado de instâncias)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  phone TEXT, profile_name TEXT,
  status TEXT DEFAULT 'connecting',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_name)
);
ALTER TABLE user_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own instances" ON user_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own instances" ON user_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own instances" ON user_instances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own instances" ON user_instances FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. TABELAS WUZAPI
-- ============================================================

-- Coluna source na user_instances (identifica qual API gerou)
ALTER TABLE public.user_instances ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'unoapi';

-- wuzapi_settings
CREATE TABLE IF NOT EXISTS public.wuzapi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url VARCHAR(255) NOT NULL DEFAULT 'https://wuzapi.bigcreditos.com.br',
  admin_token VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.wuzapi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wuzapi settings" ON public.wuzapi_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own wuzapi settings" ON public.wuzapi_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER wuzapi_settings_touch_updated_at BEFORE UPDATE ON public.wuzapi_settings FOR EACH ROW EXECUTE FUNCTION public.touch_api_settings_updated_at();

-- wuzapi_instances
CREATE TABLE IF NOT EXISTS public.wuzapi_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_id UUID REFERENCES public.wuzapi_settings(id) ON DELETE CASCADE,
  user_token VARCHAR(255) NOT NULL,
  phone VARCHAR(20), name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(settings_id, user_token)
);
ALTER TABLE public.wuzapi_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wuzapi instances" ON public.wuzapi_instances FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own wuzapi instances" ON public.wuzapi_instances FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_wuzapi_instances_user ON public.wuzapi_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_wuzapi_instances_settings ON public.wuzapi_instances(settings_id);
CREATE INDEX IF NOT EXISTS idx_user_instances_source ON public.user_instances(source);
```

---

## Supabase — Edge Functions

No terminal, autentique e faça deploy de cada função:

```bash
# Autenticar (caso não tenha feito)
npx supabase login

# Listar functions existentes (opcional)
npx supabase functions list --project-ref SEU_PROJECT_REF

# Deploy de cada função
npx supabase functions deploy unoapi-proxy       --project-ref SEU_PROJECT_REF
npx supabase functions deploy evolution-proxy     --project-ref SEU_PROJECT_REF
npx supabase functions deploy evolution-go-proxy  --project-ref SEU_PROJECT_REF
npx supabase functions deploy s3-upload           --project-ref SEU_PROJECT_REF
npx supabase functions deploy webhook-receiver    --project-ref SEU_PROJECT_REF
npx supabase functions deploy link-redirect       --project-ref SEU_PROJECT_REF
npx supabase functions deploy wuzapi-proxy        --project-ref SEU_PROJECT_REF
```

> Substitua `SEU_PROJECT_REF` pelo ID do seu projeto Supabase (ex: `wbwpzsuxwwjplyzbjqmo`). Ele aparece na URL do dashboard: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`.

---

## Vercel — Variáveis de Ambiente

No dashboard da Vercel → **Project Settings** → **Environment Variables**, adicione:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://SEU_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (anon key do Supabase > Settings > API) |
| `VITE_SUPABASE_PROJECT_ID` | `SEU_PROJECT_REF` |

**Importante:** Não usar aspas no valor.

---

## Deploy na Vercel

1. Conecte o repositório Git no dashboard da Vercel
2. Configure as variáveis de ambiente acima
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output: `dist`
6. Clique em **Deploy**

---

## Configuração Inicial

Após o deploy, acesse a aplicação e vá em **Configurações** (engrenagem) no menu lateral:

1. **UnoAPI** — URL + Token da sua instância UnoAPI
2. **Evolution API** — URL + API Key da Evolution
3. **Evolution Go** — URL + API Key do Evolution Go
4. **Chatwoot** — URL + Token + Account ID
5. **WuzAPI** — URL base + Admin Token + crie instâncias

   > **WuzAPI**: Após salvar URL e Admin Token, clique em **Nova Instância**, dê um nome, escaneie o QR Code com o WhatsApp. O status deve mudar para **Online**.

6. **AI Gateway** — API Key do provedor de IA (para variação de mensagens)

---

## Tecnologias

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (shadcn/ui)
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **APIs**: UnoAPI, Evolution API, Evolution Go, WuzAPI, Chatwoot
