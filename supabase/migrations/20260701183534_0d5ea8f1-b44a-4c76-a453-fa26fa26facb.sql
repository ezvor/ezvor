-- ============ Readiness Engine + Verifiable Proof ============

-- 1. Extend profiles with public proof fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key
  ON public.profiles (lower(handle)) WHERE handle IS NOT NULL;

-- security-definer helper so public policies can check profile visibility without recursion
CREATE OR REPLACE FUNCTION public.is_public_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND is_public = true
  );
$$;

-- allow anonymous visitors to read rows exposed via public policies
GRANT SELECT ON public.profiles TO anon;
CREATE POLICY "Public profiles are viewable"
  ON public.profiles FOR SELECT TO public
  USING (is_public = true);

-- 2. Verified solved problems (from the DSA Arena judge)
CREATE TABLE IF NOT EXISTS public.solved_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id text NOT NULL,
  problem_title text NOT NULL,
  difficulty text NOT NULL,
  topic text,
  language text,
  runtime_ms integer,
  memory_kb integer,
  solved_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, problem_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solved_problems TO authenticated;
GRANT SELECT ON public.solved_problems TO anon;
GRANT ALL ON public.solved_problems TO service_role;
ALTER TABLE public.solved_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own solved" ON public.solved_problems
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public solved viewable" ON public.solved_problems
  FOR SELECT TO public USING (public.is_public_profile(user_id));

-- 3. Roadmap skill progress (checked-off mastery items)
CREATE TABLE IF NOT EXISTS public.roadmap_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id text NOT NULL,
  stage_title text NOT NULL,
  item text NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, roadmap_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_progress TO authenticated;
GRANT SELECT ON public.roadmap_progress TO anon;
GRANT ALL ON public.roadmap_progress TO service_role;
ALTER TABLE public.roadmap_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON public.roadmap_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public progress viewable" ON public.roadmap_progress
  FOR SELECT TO public USING (public.is_public_profile(user_id));

-- 4. The user's active career target (one per user)
CREATE TABLE IF NOT EXISTS public.career_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  roadmap_id text NOT NULL,
  role_label text NOT NULL,
  company text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_targets TO authenticated;
GRANT SELECT ON public.career_targets TO anon;
GRANT ALL ON public.career_targets TO service_role;
ALTER TABLE public.career_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own target" ON public.career_targets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public target viewable" ON public.career_targets
  FOR SELECT TO public USING (public.is_public_profile(user_id));