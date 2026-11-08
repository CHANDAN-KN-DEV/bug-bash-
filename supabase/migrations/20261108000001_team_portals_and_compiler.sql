-- Team accounts, shared round state, secure compiler data and team-scoped RLS.
-- Existing student_id columns are retained and backfilled so the legacy arena
-- remains usable while all new team traffic is keyed by team_id.

CREATE OR REPLACE FUNCTION public.normalize_team_name(p_team_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_team_name, '')), '\s+', ' ', 'g'));
$$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'student', 'team'));

CREATE TABLE public.teams (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL CHECK (char_length(btrim(team_name)) BETWEEN 3 AND 30),
  team_name_normalized TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (team_name_normalized = public.normalize_team_name(team_name))
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_number SMALLINT NOT NULL CHECK (member_number IN (1, 2)),
  full_name TEXT NOT NULL,
  "class" TEXT NOT NULL,
  department TEXT NOT NULL,
  gmail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (team_id, member_number)
);
CREATE UNIQUE INDEX team_members_gmail_unique ON public.team_members (lower(gmail));
CREATE INDEX team_members_team_id_idx ON public.team_members (team_id);

-- Preserve every existing student identity as a single-member legacy team.
INSERT INTO public.teams (id, team_name, team_name_normalized, status)
SELECT p.id,
       'Legacy-' || left(p.id::text, 23),
       public.normalize_team_name('Legacy-' || left(p.id::text, 23)),
       'active'
FROM public.profiles p
WHERE p.role = 'student'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_members (team_id, member_number, full_name, "class", department, gmail)
SELECT p.id, 1, p.full_name, 'Legacy', 'Legacy', p.email
FROM public.profiles p
JOIN public.teams t ON t.id = p.id
WHERE p.role = 'student'
ON CONFLICT (team_id, member_number) DO NOTHING;

CREATE OR REPLACE FUNCTION public.team_name_available(p_team_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT char_length(btrim(coalesce(p_team_name, ''))) BETWEEN 3 AND 30
     AND public.normalize_team_name(p_team_name) <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.teams
       WHERE team_name_normalized = public.normalize_team_name(p_team_name)
     );
$$;
GRANT EXECUTE ON FUNCTION public.team_name_available(TEXT) TO anon, authenticated;

-- The Auth user is created through the registration Edge Function. This RPC is
-- deliberately service-role-only and inserts the complete identity atomically.
CREATE OR REPLACE FUNCTION public.register_team_identity(
  p_user_id UUID,
  p_internal_email TEXT,
  p_team_name TEXT,
  p_member_1 JSONB,
  p_member_2 JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized TEXT := public.normalize_team_name(p_team_name);
BEGIN
  IF p_user_id IS NULL OR char_length(btrim(p_team_name)) NOT BETWEEN 3 AND 30 THEN
    RAISE EXCEPTION 'Invalid team registration';
  END IF;
  IF p_member_1 IS NULL OR p_member_1->>'gmail' IS NULL THEN
    RAISE EXCEPTION 'Member 1 is required';
  END IF;

  INSERT INTO public.teams (id, team_name, team_name_normalized)
  VALUES (p_user_id, btrim(p_team_name), v_normalized);

  INSERT INTO public.profiles (id, role, full_name, roll_no, email)
  VALUES (p_user_id, 'team', btrim(p_team_name), NULL, p_internal_email);

  INSERT INTO public.team_members (team_id, member_number, full_name, "class", department, gmail)
  VALUES (
    p_user_id, 1, btrim(p_member_1->>'full_name'), btrim(p_member_1->>'class'),
    btrim(p_member_1->>'department'), lower(btrim(p_member_1->>'gmail'))
  );

  IF p_member_2 IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, member_number, full_name, "class", department, gmail)
    VALUES (
      p_user_id, 2, btrim(p_member_2->>'full_name'), btrim(p_member_2->>'class'),
      btrim(p_member_2->>'department'), lower(btrim(p_member_2->>'gmail'))
    );
  END IF;
  RETURN p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.register_team_identity(UUID, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_team_identity(UUID, TEXT, TEXT, JSONB, JSONB) TO service_role;

-- The old profile INSERT policy would let an authenticated user create their
-- own admin-role profile. Only admins may create profiles through PostgREST.
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Only admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

ALTER TABLE public.assignments ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.round_attempts ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.drafts ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.violations ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

UPDATE public.assignments SET team_id = student_id WHERE team_id IS NULL;
UPDATE public.round_attempts SET team_id = student_id WHERE team_id IS NULL;
UPDATE public.submissions SET team_id = student_id WHERE team_id IS NULL;
UPDATE public.drafts SET team_id = student_id WHERE team_id IS NULL;
UPDATE public.violations SET team_id = student_id WHERE team_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_legacy_team_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.team_id := coalesce(NEW.team_id, NEW.student_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignments_sync_team_id BEFORE INSERT OR UPDATE OF student_id ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_team_id();
CREATE TRIGGER attempts_sync_team_id BEFORE INSERT OR UPDATE OF student_id ON public.round_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_team_id();
CREATE TRIGGER submissions_sync_team_id BEFORE INSERT OR UPDATE OF student_id ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_team_id();
CREATE TRIGGER drafts_sync_team_id BEFORE INSERT OR UPDATE OF student_id ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_team_id();
CREATE TRIGGER violations_sync_team_id BEFORE INSERT OR UPDATE OF student_id ON public.violations
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_team_id();

CREATE OR REPLACE FUNCTION public.enforce_code_size_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF octet_length(NEW.code) > 65536 THEN
    RAISE EXCEPTION 'Source code exceeds the 64 KB limit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER drafts_code_size_limit BEFORE INSERT OR UPDATE OF code ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_code_size_limit();
CREATE TRIGGER submissions_code_size_limit BEFORE INSERT OR UPDATE OF code ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_code_size_limit();

CREATE OR REPLACE FUNCTION public.guard_team_submission_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'
  ) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.round_attempts
    WHERE id = NEW.attempt_id AND team_id = auth.uid()
      AND status IN ('time_over', 'terminated')
  ) THEN
    RAISE EXCEPTION 'Team submissions must be created by secure execution or round finalization';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER submissions_team_write_guard BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_submission_writes();

CREATE INDEX assignments_team_round_idx ON public.assignments (team_id, round_id);
CREATE INDEX attempts_team_round_idx ON public.round_attempts (team_id, round_id);
CREATE INDEX submissions_team_idx ON public.submissions (team_id);
CREATE INDEX drafts_team_idx ON public.drafts (team_id);
CREATE INDEX violations_team_idx ON public.violations (team_id, created_at DESC);

ALTER TABLE public.programs
  ADD COLUMN time_limit_ms INTEGER NOT NULL DEFAULT 2000 CHECK (time_limit_ms BETWEEN 100 AND 30000),
  ADD COLUMN memory_limit_kb INTEGER NOT NULL DEFAULT 262144 CHECK (memory_limit_kb BETWEEN 16384 AND 1048576),
  ADD COLUMN max_runs INTEGER CHECK (max_runs IS NULL OR max_runs > 0);

CREATE TABLE public.test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  input TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points >= 0),
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX test_cases_program_idx ON public.test_cases (program_id);

ALTER TABLE public.submissions
  ADD COLUMN tests_passed INTEGER NOT NULL DEFAULT 0 CHECK (tests_passed >= 0),
  ADD COLUMN tests_total INTEGER NOT NULL DEFAULT 0 CHECK (tests_total >= 0),
  ADD COLUMN final_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN manual_score INTEGER,
  ADD COLUMN manual_review_notes TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.code_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.round_attempts(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  source_code TEXT NOT NULL,
  stdin TEXT NOT NULL DEFAULT '',
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  compile_errors TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  time_ms INTEGER,
  memory_kb INTEGER,
  tests_passed INTEGER,
  tests_total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX code_runs_team_recent_idx ON public.code_runs (team_id, created_at DESC);
CREATE INDEX code_runs_attempt_program_idx ON public.code_runs (attempt_id, program_id, created_at DESC);

CREATE TABLE public.results (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  programs_solved INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  total_time_ms BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (team_id, round_id)
);

CREATE VIEW public.leaderboard AS
SELECT totals.team_name,
       totals.score,
       dense_rank() OVER (ORDER BY totals.score DESC, totals.total_time_ms ASC) AS rank
FROM (
  SELECT t.id, t.team_name, sum(r.score)::INTEGER AS score, sum(r.total_time_ms)::BIGINT AS total_time_ms
  FROM public.results r
  JOIN public.teams t ON t.id = r.team_id
  WHERE t.status = 'active'
  GROUP BY t.id, t.team_name
) totals;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

ALTER TABLE public.exam_settings
  ADD COLUMN team_session_policy TEXT NOT NULL DEFAULT 'block'
  CHECK (team_session_policy IN ('block', 'takeover'));

CREATE TABLE public.team_sessions (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (team_id, round_id)
);

CREATE TABLE public.team_login_attempts (
  fingerprint TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.allow_team_login(p_fingerprint TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_attempts public.team_login_attempts%ROWTYPE;
BEGIN
  INSERT INTO public.team_login_attempts (fingerprint) VALUES (p_fingerprint)
  ON CONFLICT (fingerprint) DO NOTHING;
  SELECT * INTO v_attempts FROM public.team_login_attempts WHERE fingerprint = p_fingerprint FOR UPDATE;
  IF v_attempts.window_started_at < now() - interval '15 minutes' THEN
    UPDATE public.team_login_attempts SET window_started_at = now(), failed_attempts = 0, updated_at = now()
    WHERE fingerprint = p_fingerprint;
    RETURN true;
  END IF;
  RETURN v_attempts.failed_attempts < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_team_login_failure(p_fingerprint TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.team_login_attempts (fingerprint, failed_attempts)
  VALUES (p_fingerprint, 1)
  ON CONFLICT (fingerprint) DO UPDATE
    SET failed_attempts = CASE
          WHEN public.team_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1
          ELSE public.team_login_attempts.failed_attempts + 1
        END,
        window_started_at = CASE
          WHEN public.team_login_attempts.window_started_at < now() - interval '15 minutes' THEN now()
          ELSE public.team_login_attempts.window_started_at
        END,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_team_login_failures(p_fingerprint TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ DELETE FROM public.team_login_attempts WHERE fingerprint = p_fingerprint; $$;

REVOKE ALL ON FUNCTION public.allow_team_login(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_team_login_failure(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_team_login_failures(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_team_login(TEXT), public.record_team_login_failure(TEXT), public.clear_team_login_failures(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_team_session(p_round_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id UUID := auth.uid();
  v_current public.team_sessions%ROWTYPE;
  v_policy TEXT;
BEGIN
  IF v_team_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.teams WHERE id = v_team_id AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_team_id AND role = 'team'
  ) THEN RAISE EXCEPTION 'Team account is not active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_team_id::text || p_round_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.rounds WHERE id = p_round_id AND status = 'live') THEN
    RAISE EXCEPTION 'Round is not live';
  END IF;
  SELECT team_session_policy INTO v_policy FROM public.exam_settings WHERE id = 1;
  SELECT * INTO v_current FROM public.team_sessions
    WHERE team_id = v_team_id AND round_id = p_round_id FOR UPDATE;
  IF FOUND AND v_current.session_id <> p_session_id
     AND v_current.last_seen_at > now() - interval '60 seconds'
     AND v_policy = 'block' THEN
    RAISE EXCEPTION 'Another team session is active';
  END IF;
  INSERT INTO public.team_sessions (team_id, round_id, session_id, last_seen_at)
  VALUES (v_team_id, p_round_id, p_session_id, now())
  ON CONFLICT (team_id, round_id) DO UPDATE
    SET session_id = EXCLUDED.session_id, last_seen_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_team_session(p_round_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team') THEN
    RAISE EXCEPTION 'Team access required';
  END IF;
  UPDATE public.team_sessions
  SET last_seen_at = now()
  WHERE team_id = auth.uid() AND round_id = p_round_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team session is no longer active'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_team_session(UUID, UUID), public.heartbeat_team_session(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_team_session(UUID, UUID), public.heartbeat_team_session(UUID, UUID) TO authenticated;

-- Atomically reserve a run, enforcing ownership, live timer, session lease,
-- byte cap, and per-program run count before any code reaches the judge.
CREATE OR REPLACE FUNCTION public.reserve_team_code_run(
  p_team_id UUID,
  p_attempt_id UUID,
  p_program_id UUID,
  p_session_id UUID,
  p_source_code TEXT,
  p_stdin TEXT,
  p_mode TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.round_attempts%ROWTYPE;
  v_program public.programs%ROWTYPE;
  v_run_id UUID;
BEGIN
  IF octet_length(p_source_code) > 65536 OR octet_length(p_stdin) > 16384 THEN
    RAISE EXCEPTION 'Code or stdin exceeds the permitted size';
  END IF;
  IF p_mode NOT IN ('run', 'submit') THEN RAISE EXCEPTION 'Invalid run mode'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_team_id::text || p_attempt_id::text || p_program_id::text, 0));
  SELECT * INTO v_attempt FROM public.round_attempts
    WHERE id = p_attempt_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'in_progress' OR now() >= v_attempt.ends_at THEN
    RAISE EXCEPTION 'Round is no longer active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND status = 'active') THEN
    RAISE EXCEPTION 'Team account is not active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rounds WHERE id = v_attempt.round_id AND status = 'live') THEN
    RAISE EXCEPTION 'Round is not live';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_sessions
    WHERE team_id = p_team_id AND round_id = v_attempt.round_id
      AND session_id = p_session_id AND last_seen_at > now() - interval '60 seconds') THEN
    RAISE EXCEPTION 'Team session is no longer active';
  END IF;
  SELECT * INTO v_program FROM public.programs
    WHERE id = p_program_id AND round_id = v_attempt.round_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.assignments WHERE team_id = p_team_id AND program_id = p_program_id
  ) THEN RAISE EXCEPTION 'Program is not assigned to this team'; END IF;
  IF v_program.max_runs IS NOT NULL AND (
    SELECT count(*) FROM public.code_runs
    WHERE team_id = p_team_id AND attempt_id = p_attempt_id AND program_id = p_program_id
  ) >= v_program.max_runs THEN RAISE EXCEPTION 'Run limit reached'; END IF;
  IF (
    SELECT count(*) FROM public.code_runs
    WHERE team_id = p_team_id AND created_at > now() - interval '1 minute'
  ) >= 15 THEN RAISE EXCEPTION 'Run rate limit reached'; END IF;

  INSERT INTO public.code_runs (team_id, attempt_id, program_id, language, source_code, stdin, status)
  VALUES (p_team_id, p_attempt_id, p_program_id, v_program.language, p_source_code, p_stdin, 'queued')
  RETURNING id INTO v_run_id;
  RETURN v_run_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_team_code_run(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_team_code_run(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- Admins can release a device lease to support supervised re-entry.
CREATE OR REPLACE FUNCTION public.allow_team_reentry(
  p_team_id UUID,
  p_round_id UUID,
  p_additional_minutes INTEGER DEFAULT 10
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_additional_minutes NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Re-entry duration must be between 1 and 120 minutes';
  END IF;
  DELETE FROM public.team_sessions WHERE team_id = p_team_id AND round_id = p_round_id;
  UPDATE public.round_attempts
  SET status = 'in_progress',
      completed_at = NULL,
      termination_reason = NULL,
      started_at = now(),
      ends_at = now() + (p_additional_minutes * interval '1 minute')
  WHERE team_id = p_team_id AND round_id = p_round_id
    AND status IN ('terminated', 'time_over')
    AND p_additional_minutes BETWEEN 1 AND 120;
END;
$$;
REVOKE ALL ON FUNCTION public.allow_team_reentry(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allow_team_reentry(UUID, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_team_round(p_attempt_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.round_attempts%ROWTYPE;
  v_status TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team') THEN
    RAISE EXCEPTION 'Team access required';
  END IF;
  SELECT * INTO v_attempt FROM public.round_attempts
  WHERE id = p_attempt_id AND team_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_attempt.status = 'in_progress' AND now() >= v_attempt.ends_at THEN
    UPDATE public.round_attempts SET status = 'time_over', completed_at = now()
    WHERE id = p_attempt_id;
    v_status := 'time_over';
  ELSIF v_attempt.status = 'terminated' THEN
    v_status := 'terminated';
  ELSIF v_attempt.status = 'time_over' THEN
    v_status := 'time_over';
  ELSE
    RAISE EXCEPTION 'Round is still active';
  END IF;

  INSERT INTO public.submissions (
    attempt_id, program_id, student_id, team_id, code, status, submitted_at,
    score, tests_passed, tests_total, final_status
  )
  SELECT d.attempt_id, d.program_id, d.student_id, d.team_id, d.code,
         'incomplete', now(), 0, 0, 0, v_status
  FROM public.drafts d
  WHERE d.attempt_id = p_attempt_id AND d.team_id = auth.uid()
  ON CONFLICT (attempt_id, program_id) DO UPDATE SET
    code = EXCLUDED.code,
    status = 'incomplete',
    submitted_at = now(),
    final_status = EXCLUDED.final_status
  WHERE public.submissions.final_status <> 'solved';
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_team_round(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_team_round(UUID) TO authenticated;

-- Team-specific policies. Direct client inserts to code_runs are intentionally
-- not granted; the execution Edge Function is the only run writer.
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_read_self_or_admin ON public.teams
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY teams_admin_manage ON public.teams
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY members_read_self_or_admin ON public.team_members
  FOR SELECT TO authenticated USING (team_id = auth.uid() OR public.is_admin());
CREATE POLICY members_admin_manage ON public.team_members
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY test_cases_read_visible_or_admin ON public.test_cases
  FOR SELECT TO authenticated USING (
    public.is_admin() OR (
      NOT is_hidden AND EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.team_id = auth.uid() AND a.program_id = test_cases.program_id
      )
    )
  );
CREATE POLICY test_cases_admin_manage ON public.test_cases
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY code_runs_read_self_or_admin ON public.code_runs
  FOR SELECT TO authenticated USING (team_id = auth.uid() OR public.is_admin());
CREATE POLICY results_read_self_or_admin ON public.results
  FOR SELECT TO authenticated USING (team_id = auth.uid() OR public.is_admin());
CREATE POLICY sessions_read_self_or_admin ON public.team_sessions
  FOR SELECT TO authenticated USING (team_id = auth.uid() OR public.is_admin());
CREATE POLICY sessions_admin_manage ON public.team_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.team_login_attempts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.code_runs FROM anon, authenticated;
GRANT SELECT ON public.code_runs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.test_cases FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cases TO authenticated;

-- Preserve student self-service while preventing a team token from using the
-- legacy submission or attempt-write policies to bypass the compiler function.
DROP POLICY IF EXISTS "Students can insert own attempts" ON public.round_attempts;
CREATE POLICY "Students can insert own attempts" ON public.round_attempts
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ))
  );
DROP POLICY IF EXISTS "Attempts updatable by owner or admin" ON public.round_attempts;
CREATE POLICY "Attempts updatable by owner or admin" ON public.round_attempts
  FOR UPDATE TO authenticated USING (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ))
  ) WITH CHECK (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ))
  );
DROP POLICY IF EXISTS "Students can insert own submissions before deadline" ON public.submissions;
CREATE POLICY "Students can insert own submissions before deadline" ON public.submissions
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM public.round_attempts ra WHERE ra.id = attempt_id
        AND ra.student_id = auth.uid() AND ra.status = 'in_progress' AND now() <= ra.ends_at
    ))
  );
DROP POLICY IF EXISTS "Students can update own submissions before deadline" ON public.submissions;
CREATE POLICY "Students can update own submissions before deadline" ON public.submissions
  FOR UPDATE TO authenticated USING (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM public.round_attempts ra WHERE ra.id = attempt_id
        AND ra.student_id = auth.uid() AND ra.status = 'in_progress' AND now() <= ra.ends_at
    ))
  ) WITH CHECK (
    public.is_admin() OR (auth.uid() = student_id AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'student'
    ))
  );

-- Enable realtime for team-visible run history and leaderboard source data.
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.results;
