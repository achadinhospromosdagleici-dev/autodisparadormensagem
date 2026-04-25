-- Backfill profiles para usuários que existem em auth.users mas não têm profile
INSERT INTO public.profiles (id, email, full_name, trial_started_at, trial_ends_at, is_active)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  now(),
  CASE 
    WHEN lower(u.email) = lower('bigcreditossf@gmail.com') THEN now() + interval '100 years'
    ELSE now() + interval '3 days'
  END,
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  u.id,
  CASE 
    WHEN lower(u.email) = lower('bigcreditossf@gmail.com') THEN 'superadmin'::public.app_role
    ELSE 'user'::public.app_role
  END
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;