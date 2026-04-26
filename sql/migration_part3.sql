-- ============================================================
-- PARTE 3: User Instances Table
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Create user_instances table
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

-- Enable RLS
ALTER TABLE public.user_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own instances" ON public.user_instances;
CREATE POLICY "Users can view their own instances" ON public.user_instances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own instances" ON public.user_instances;
CREATE POLICY "Users can insert their own instances" ON public.user_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own instances" ON public.user_instances;
CREATE POLICY "Users can update their own instances" ON public.user_instances
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own instances" ON public.user_instances;
CREATE POLICY "Users can delete their own instances" ON public.user_instances
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Superadmins can view all instances" ON public.user_instances;
CREATE POLICY "Superadmins can view all instances" ON public.user_instances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
  );

-- Function to register instance after user scans QR Code
CREATE OR REPLACE FUNCTION public.register_user_instance(
  p_user_id UUID,
  p_instance_name TEXT,
  p_phone TEXT,
  p_profile_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_instances (user_id, instance_name, phone, profile_name, status)
  VALUES (p_user_id, p_instance_name, p_phone, p_profile_name, 'connected')
  ON CONFLICT (user_id, instance_name) DO UPDATE
  SET phone = EXCLUDED.phone,
      profile_name = EXCLUDED.profile_name,
      status = 'connected',
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get only user's instances
CREATE OR REPLACE FUNCTION public.get_user_instances(p_user_id UUID)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ui.instance_name as id,
    COALESCE(ui.profile_name, ui.instance_name) as name,
    ui.phone,
    ui.status
  FROM public.user_instances ui
  WHERE ui.user_id = p_user_id AND ui.status = 'connected';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION public.register_user_instance(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_instances(UUID) TO authenticated;