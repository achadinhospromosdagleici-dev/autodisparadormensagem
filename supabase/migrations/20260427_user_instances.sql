-- Create user_instances table to track which Evolution instances belong to which user
-- This ensures users only see their own connected numbers

CREATE TABLE IF NOT EXISTS user_instances (
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
ALTER TABLE user_instances ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own instances" ON user_instances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instances" ON user_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instances" ON user_instances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instances" ON user_instances
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Superadmins can view all instances" ON user_instances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
  );

-- Function to register instance after user scans QR Code
CREATE OR REPLACE FUNCTION register_user_instance(
  p_user_id UUID,
  p_instance_name TEXT,
  p_phone TEXT,
  p_profile_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_instances (user_id, instance_name, phone, profile_name, status)
  VALUES (p_user_id, p_instance_name, p_phone, p_profile_name, 'connected')
  ON CONFLICT (user_id, instance_name) DO UPDATE
  SET phone = EXCLUDED.phone,
      profile_name = EXCLUDED.profile_name,
      status = 'connected',
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get only user's instances (for selection in campaign)
CREATE OR REPLACE FUNCTION get_user_instances(p_user_id UUID)
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
  FROM user_instances ui
  WHERE ui.user_id = p_user_id AND ui.status = 'connected';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;