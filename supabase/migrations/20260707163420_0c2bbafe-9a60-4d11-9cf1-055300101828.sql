CREATE TABLE public.problem_statements (
  slug TEXT NOT NULL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.problem_statements TO service_role;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;