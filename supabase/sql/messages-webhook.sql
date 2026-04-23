-- ==============================================
-- NEXIA - Tabelas para Webhook de Mensagens
-- Execute este SQL no Supabase Dashboard
-- ==============================================

-- 1. Tabela de conversas (uma por contato/número)
CREATE TABLE IF NOT EXISTS conversations (
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

-- 2. Tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
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

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversations_instance_phone ON conversations(instance_name, phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_instance ON messages(instance_name);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS (permissões)
-- Qualquer usuário autenticado pode ler e escrever nestas tabelas
-- (Ajuste conforme necessário para sua segurança)
CREATE POLICY "Allow all for authenticated users" ON conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Habilitar realtime para mensagens (opcional - para updates em tempo real)
-- Descomente se quiser receber atualizações em tempo real via Supabase Realtime
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ==============================================
-- FIM DO SQL
-- ==============================================