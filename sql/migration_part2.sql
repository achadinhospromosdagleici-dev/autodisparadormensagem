-- ============================================================
-- PARTE 2: Funções, Triggers e Políticas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============== SECURITY DEFINER FUNCTIONS ==============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trial_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND is_active = true
      AND trial_ends_at > now()
  ) OR public.has_role(_user_id, 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.get_shared_evolution()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.system_settings WHERE key = 'shared_evolution';
$$;

-- ============== TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS system_settings_touch_updated_at ON public.system_settings;
CREATE TRIGGER system_settings_touch_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== HANDLE NEW USER ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_super BOOLEAN := false;
BEGIN
  -- ALTERE O EMAIL ABAIXO PARA SER SUPERADMIN
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
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_super THEN 'superadmin'::public.app_role ELSE 'user'::public.app_role END);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== RLS POLICIES: profiles ==============
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.profiles;
CREATE POLICY "Superadmin can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Users can update own profile basic fields" ON public.profiles;
CREATE POLICY "Users can update own profile basic fields"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Superadmin can update any profile" ON public.profiles;
CREATE POLICY "Superadmin can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Superadmin can insert profiles" ON public.profiles;
CREATE POLICY "Superadmin can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Superadmin can delete profiles" ON public.profiles;
CREATE POLICY "Superadmin can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

-- ============== RLS POLICIES: user_roles ==============
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Superadmin can view all roles" ON public.user_roles;
CREATE POLICY "Superadmin can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Superadmin can manage roles" ON public.user_roles;
CREATE POLICY "Superadmin can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ============== RLS POLICIES: system_settings ==============
DROP POLICY IF EXISTS "Superadmin can view settings" ON public.system_settings;
CREATE POLICY "Superadmin can view settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Superadmin can manage settings" ON public.system_settings;
CREATE POLICY "Superadmin can manage settings"
ON public.system_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- GRANTS
GRANT EXECUTE ON FUNCTION public.get_shared_evolution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trial_active(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;