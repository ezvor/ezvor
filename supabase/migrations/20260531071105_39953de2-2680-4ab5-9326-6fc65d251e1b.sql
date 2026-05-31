CREATE TABLE public.opportunity_status (
  opp_id text PRIMARY KEY,
  status text NOT NULL,
  status_note text,
  source_url text,
  source_title text,
  reason text,
  confidence text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.opportunity_status TO anon, authenticated;
GRANT ALL ON public.opportunity_status TO service_role;

ALTER TABLE public.opportunity_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view opportunity statuses"
ON public.opportunity_status FOR SELECT
USING (true);

CREATE TABLE public.opportunity_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opp_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  source_url text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.opportunity_status_log TO anon, authenticated;
GRANT ALL ON public.opportunity_status_log TO service_role;

ALTER TABLE public.opportunity_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view status change log"
ON public.opportunity_status_log FOR SELECT
USING (true);

CREATE INDEX idx_status_log_opp ON public.opportunity_status_log (opp_id, changed_at DESC);
CREATE INDEX idx_status_log_changed ON public.opportunity_status_log (changed_at DESC);