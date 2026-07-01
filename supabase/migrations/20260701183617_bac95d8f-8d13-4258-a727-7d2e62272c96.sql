-- Replace SECURITY DEFINER helper with inline EXISTS checks against public profiles.
DROP POLICY IF EXISTS "Public solved viewable" ON public.solved_problems;
DROP POLICY IF EXISTS "Public progress viewable" ON public.roadmap_progress;
DROP POLICY IF EXISTS "Public target viewable" ON public.career_targets;
DROP FUNCTION IF EXISTS public.is_public_profile(uuid);

CREATE POLICY "Public solved viewable" ON public.solved_problems
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = solved_problems.user_id AND p.is_public = true
  ));

CREATE POLICY "Public progress viewable" ON public.roadmap_progress
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = roadmap_progress.user_id AND p.is_public = true
  ));

CREATE POLICY "Public target viewable" ON public.career_targets
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = career_targets.user_id AND p.is_public = true
  ));