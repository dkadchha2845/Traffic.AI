
-- ============================================================
-- PHASE 1: Security — User Roles System
-- ============================================================

-- 1a. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 1b. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 1c. Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- 1d. RLS policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 1e. Auto-assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Fix missing profile trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PHASE 3: Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_data_user_id ON public.traffic_data (user_id);
CREATE INDEX IF NOT EXISTS idx_signal_logs_user_id ON public.signal_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON public.performance_metrics (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_data_created_at ON public.traffic_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_logs_created_at ON public.signal_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_data_user_time ON public.traffic_data (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_logs_user_time ON public.signal_logs (user_id, created_at DESC);
