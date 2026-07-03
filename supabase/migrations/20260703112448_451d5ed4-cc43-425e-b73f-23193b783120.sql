-- Submissions history (per user, per problem) for accurate cross-device tracking + streaks
CREATE TABLE public.code_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  problem_slug TEXT NOT NULL,
  problem_title TEXT,
  status TEXT NOT NULL,
  language TEXT NOT NULL,
  passed INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  runtime_ms INT,
  memory_kb INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_submissions TO authenticated;
GRANT ALL ON public.code_submissions TO service_role;
ALTER TABLE public.code_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own submissions"
  ON public.code_submissions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own submissions"
  ON public.code_submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX code_submissions_user_created_idx ON public.code_submissions (user_id, created_at DESC);
CREATE INDEX code_submissions_user_slug_idx ON public.code_submissions (user_id, problem_slug, created_at DESC);

-- Cached AI-generated editorials + multi-language solutions (keyed by problem slug)
CREATE TABLE public.problem_solutions (
  slug TEXT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.problem_solutions TO service_role;
ALTER TABLE public.problem_solutions ENABLE ROW LEVEL SECURITY;