-- ============================================================================
-- BUG BASH ARENA: Database Schema, Security (RLS), Realtime & RPCs
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')) DEFAULT 'student',
    full_name TEXT NOT NULL,
    roll_no TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. EXAM SETTINGS
CREATE TABLE IF NOT EXISTS public.exam_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    strict_mode BOOLEAN NOT NULL DEFAULT true, -- Immediate termination on first violation
    max_warnings INT NOT NULL DEFAULT 3,
    block_copy_paste BOOLEAN NOT NULL DEFAULT true,
    require_fullscreen BOOLEAN NOT NULL DEFAULT true,
    grace_period_seconds INT NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Insert default settings row if not present
INSERT INTO public.exam_settings (id, strict_mode, max_warnings, block_copy_paste, require_fullscreen, grace_period_seconds)
VALUES (1, true, 3, true, true, 2)
ON CONFLICT (id) DO NOTHING;

-- 3. ROUNDS TABLE
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INT NOT NULL UNIQUE CHECK (round_number IN (1, 2, 3)),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'live', 'stopped', 'completed')) DEFAULT 'draft',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index rounds
CREATE INDEX IF NOT EXISTS idx_rounds_status ON public.rounds(status);

-- 4. PROGRAMS (BUGGY CODE)
-- Note: reference_solution is stored in a separate admin-only table `program_solutions`
-- to guarantee by database design that students CANNOT read it.
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'python', -- python, javascript, cpp, java
    description TEXT NOT NULL,
    buggy_code TEXT NOT NULL,
    points INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_programs_round_id ON public.programs(round_id);

-- 5. PROGRAM SOLUTIONS (ADMIN-ONLY ACCESS)
CREATE TABLE IF NOT EXISTS public.program_solutions (
    program_id UUID PRIMARY KEY REFERENCES public.programs(id) ON DELETE CASCADE,
    reference_solution TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(student_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_student ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_round ON public.assignments(round_id);

-- 7. ROUND ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.round_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'time_over', 'terminated')) DEFAULT 'not_started',
    termination_reason TEXT,
    warnings_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(student_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_student_round ON public.round_attempts(student_id, round_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.round_attempts(status);

-- 8. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.round_attempts(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('submitted', 'incomplete', 'evaluated')) DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    score INT DEFAULT 0,
    UNIQUE(attempt_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_attempt ON public.submissions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id);

-- 9. DRAFTS TABLE (AUTOSAVE)
CREATE TABLE IF NOT EXISTS public.drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.round_attempts(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(attempt_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_student ON public.drafts(student_id);

-- 10. VIOLATIONS TABLE
CREATE TABLE IF NOT EXISTS public.violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.round_attempts(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL, -- 'tab_switch', 'window_blur', 'fullscreen_exit', 'clipboard_action', 'resize_suspicious'
    details TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_violations_student ON public.violations(student_id);
CREATE INDEX IF NOT EXISTS idx_violations_round ON public.violations(round_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles updatable by admin or self (name only)" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (public.is_admin() OR (auth.uid() = id AND role = 'student'));

CREATE POLICY "Admin can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.is_admin() OR auth.uid() = id);

CREATE POLICY "Admin can delete profiles" ON public.profiles
    FOR DELETE USING (public.is_admin());

-- EXAM SETTINGS RLS
CREATE POLICY "Exam settings viewable by authenticated users" ON public.exam_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Exam settings editable only by admin" ON public.exam_settings
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ROUNDS RLS
CREATE POLICY "Rounds viewable by authenticated users" ON public.rounds
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Rounds editable only by admin" ON public.rounds
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PROGRAMS RLS
-- Students can only view programs that have been assigned to them
CREATE POLICY "Students can view assigned programs; Admins see all" ON public.programs
    FOR SELECT TO authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.program_id = programs.id AND a.student_id = auth.uid()
        )
    );

CREATE POLICY "Programs editable only by admin" ON public.programs
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PROGRAM SOLUTIONS RLS (STRICTEST: ONLY ADMINS)
CREATE POLICY "Solutions ONLY viewable by admin" ON public.program_solutions
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Solutions ONLY modifiable by admin" ON public.program_solutions
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ASSIGNMENTS RLS
CREATE POLICY "Students view own assignments; Admin views all" ON public.assignments
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Assignments modifiable only by admin" ON public.assignments
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ROUND ATTEMPTS RLS
CREATE POLICY "Students view own attempts; Admin views all" ON public.round_attempts
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Students can insert own attempts" ON public.round_attempts
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Attempts updatable by owner or admin" ON public.round_attempts
    FOR UPDATE TO authenticated
    USING (auth.uid() = student_id OR public.is_admin())
    WITH CHECK (auth.uid() = student_id OR public.is_admin());

-- SUBMISSIONS RLS
CREATE POLICY "Students view own submissions; Admin views all" ON public.submissions
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Students can insert own submissions before deadline" ON public.submissions
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin() OR
        (auth.uid() = student_id AND EXISTS (
            SELECT 1 FROM public.round_attempts ra
            WHERE ra.id = attempt_id 
              AND ra.student_id = auth.uid()
              AND ra.status = 'in_progress'
              AND timezone('utc'::text, now()) <= ra.ends_at
        ))
    );

CREATE POLICY "Students can update own submissions before deadline" ON public.submissions
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() OR
        (auth.uid() = student_id AND EXISTS (
            SELECT 1 FROM public.round_attempts ra
            WHERE ra.id = attempt_id 
              AND ra.student_id = auth.uid()
              AND ra.status = 'in_progress'
              AND timezone('utc'::text, now()) <= ra.ends_at
        ))
    );

-- DRAFTS RLS
CREATE POLICY "Students view own drafts; Admin views all" ON public.drafts
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Students can insert own drafts before deadline" ON public.drafts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = student_id AND EXISTS (
            SELECT 1 FROM public.round_attempts ra
            WHERE ra.id = attempt_id 
              AND ra.student_id = auth.uid()
              AND ra.status = 'in_progress'
              AND timezone('utc'::text, now()) <= ra.ends_at
        )
    );

CREATE POLICY "Students can update own drafts before deadline" ON public.drafts
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = student_id AND EXISTS (
            SELECT 1 FROM public.round_attempts ra
            WHERE ra.id = attempt_id 
              AND ra.student_id = auth.uid()
              AND ra.status = 'in_progress'
              AND timezone('utc'::text, now()) <= ra.ends_at
        )
    );

-- VIOLATIONS RLS
CREATE POLICY "Students view own violations; Admin views all" ON public.violations
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id OR public.is_admin());

CREATE POLICY "Students can log own violations; Admin can log any" ON public.violations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = student_id OR public.is_admin());

-- ============================================================================
-- STORED PROCEDURES / RPC FUNCTIONS (SERVER AS SOURCE OF TRUTH)
-- ============================================================================

-- Function to start a round attempt with server-side time calculation
CREATE OR REPLACE FUNCTION public.start_round_attempt(p_round_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_student_id UUID;
    v_round RECORD;
    v_existing_attempt RECORD;
    v_new_attempt RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_ends_at TIMESTAMPTZ;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch round details
    SELECT * INTO v_round FROM public.rounds WHERE id = p_round_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round not found';
    END IF;

    IF v_round.status != 'live' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Round is not live yet';
    END IF;

    -- Check if student already has an attempt
    SELECT * INTO v_existing_attempt 
    FROM public.round_attempts 
    WHERE student_id = v_student_id AND round_id = p_round_id;

    IF FOUND THEN
        -- If terminated or completed, cannot restart
        IF v_existing_attempt.status IN ('completed', 'time_over', 'terminated') THEN
            RETURN to_jsonb(v_existing_attempt);
        END IF;

        -- If already in progress, return existing attempt (timer continues!)
        IF v_existing_attempt.status = 'in_progress' THEN
            -- Check if expired in background
            IF v_now > v_existing_attempt.ends_at THEN
                UPDATE public.round_attempts
                SET status = 'time_over'
                WHERE id = v_existing_attempt.id
                RETURNING * INTO v_existing_attempt;
            END IF;
            RETURN to_jsonb(v_existing_attempt);
        END IF;
    END IF;

    -- Calculate ends_at strictly from server clock
    v_ends_at := v_now + (v_round.duration_minutes * interval '1 minute');

    -- Insert new attempt
    INSERT INTO public.round_attempts (
        student_id,
        round_id,
        started_at,
        ends_at,
        status,
        warnings_count
    ) VALUES (
        v_student_id,
        p_round_id,
        v_now,
        v_ends_at,
        'in_progress',
        0
    )
    ON CONFLICT (student_id, round_id) DO UPDATE
    SET started_at = EXCLUDED.started_at,
        ends_at = EXCLUDED.ends_at,
        status = 'in_progress'
    RETURNING * INTO v_new_attempt;

    RETURN to_jsonb(v_new_attempt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely save draft with server-side time verification
CREATE OR REPLACE FUNCTION public.save_draft(
    p_attempt_id UUID,
    p_program_id UUID,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_attempt RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_draft RECORD;
BEGIN
    SELECT * INTO v_attempt FROM public.round_attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    IF v_attempt.student_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized attempt access';
    END IF;

    IF v_attempt.status != 'in_progress' THEN
        RAISE EXCEPTION 'Round is no longer active (Status: %)', v_attempt.status;
    END IF;

    IF v_now > v_attempt.ends_at THEN
        UPDATE public.round_attempts SET status = 'time_over' WHERE id = p_attempt_id;
        RAISE EXCEPTION 'Time limit reached';
    END IF;

    INSERT INTO public.drafts (attempt_id, program_id, student_id, code, updated_at)
    VALUES (p_attempt_id, p_program_id, v_attempt.student_id, p_code, v_now)
    ON CONFLICT (attempt_id, program_id) DO UPDATE
    SET code = EXCLUDED.code,
        updated_at = EXCLUDED.updated_at
    RETURNING * INTO v_draft;

    RETURN to_jsonb(v_draft);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit a single program with server-side verification
CREATE OR REPLACE FUNCTION public.submit_program(
    p_attempt_id UUID,
    p_program_id UUID,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_attempt RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_sub RECORD;
    v_program RECORD;
BEGIN
    SELECT * INTO v_attempt FROM public.round_attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    IF v_attempt.student_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized attempt access';
    END IF;

    IF v_attempt.status != 'in_progress' THEN
        RAISE EXCEPTION 'Round attempt is not in progress';
    END IF;

    IF v_now > v_attempt.ends_at THEN
        UPDATE public.round_attempts SET status = 'time_over' WHERE id = p_attempt_id;
        RAISE EXCEPTION 'Time limit reached. Submissions locked.';
    END IF;

    SELECT * INTO v_program FROM public.programs WHERE id = p_program_id;

    INSERT INTO public.submissions (
        attempt_id,
        program_id,
        student_id,
        code,
        status,
        submitted_at,
        score
    ) VALUES (
        p_attempt_id,
        p_program_id,
        v_attempt.student_id,
        p_code,
        'submitted',
        v_now,
        COALESCE(v_program.points, 10)
    )
    ON CONFLICT (attempt_id, program_id) DO UPDATE
    SET code = EXCLUDED.code,
        submitted_at = EXCLUDED.submitted_at,
        status = 'submitted',
        score = EXCLUDED.score
    RETURNING * INTO v_sub;

    RETURN to_jsonb(v_sub);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finish round and record completion
CREATE OR REPLACE FUNCTION public.finish_round(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_attempt RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    SELECT * INTO v_attempt FROM public.round_attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    IF v_attempt.student_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized attempt';
    END IF;

    UPDATE public.round_attempts
    SET status = 'completed',
        completed_at = v_now
    WHERE id = p_attempt_id
    RETURNING * INTO v_attempt;

    RETURN to_jsonb(v_attempt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log violation and trigger auto-termination if policy mandates
CREATE OR REPLACE FUNCTION public.record_violation(
    p_attempt_id UUID,
    p_round_id UUID,
    p_violation_type TEXT,
    p_details TEXT,
    p_user_agent TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_student_id UUID := auth.uid();
    v_settings RECORD;
    v_attempt RECORD;
    v_violation RECORD;
    v_new_warnings INT;
    v_terminate BOOLEAN := false;
BEGIN
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_settings FROM public.exam_settings WHERE id = 1;
    SELECT * INTO v_attempt FROM public.round_attempts WHERE id = p_attempt_id;

    -- Insert violation
    INSERT INTO public.violations (
        student_id,
        round_id,
        attempt_id,
        violation_type,
        details,
        user_agent
    ) VALUES (
        v_student_id,
        p_round_id,
        p_attempt_id,
        p_violation_type,
        p_details,
        p_user_agent
    )
    RETURNING * INTO v_violation;

    IF FOUND AND v_attempt.status = 'in_progress' THEN
        v_new_warnings := v_attempt.warnings_count + 1;
        
        -- Determine termination policy
        IF v_settings.strict_mode THEN
            v_terminate := true;
        ELSIF v_new_warnings >= v_settings.max_warnings THEN
            v_terminate := true;
        END IF;

        IF v_terminate THEN
            UPDATE public.round_attempts
            SET status = 'terminated',
                warnings_count = v_new_warnings,
                termination_reason = 'Terminated due to security policy violation (' || p_violation_type || ')'
            WHERE id = p_attempt_id;
        ELSE
            UPDATE public.round_attempts
            SET warnings_count = v_new_warnings
            WHERE id = p_attempt_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'violation', to_jsonb(v_violation),
        'terminated', v_terminate,
        'warnings_count', COALESCE(v_new_warnings, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to re-allow a terminated student
CREATE OR REPLACE FUNCTION public.reallow_student(
    p_attempt_id UUID,
    p_additional_minutes INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_attempt RECORD;
    v_new_ends_at TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can re-allow terminated students';
    END IF;

    SELECT * INTO v_attempt FROM public.round_attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    -- Adjust end time if necessary
    IF p_additional_minutes > 0 OR timezone('utc'::text, now()) >= v_attempt.ends_at THEN
        v_new_ends_at := timezone('utc'::text, now()) + (COALESCE(p_additional_minutes, 10) * interval '1 minute');
    ELSE
        v_new_ends_at := v_attempt.ends_at;
    END IF;

    UPDATE public.round_attempts
    SET status = 'in_progress',
        termination_reason = NULL,
        warnings_count = 0,
        ends_at = v_new_ends_at
    WHERE id = p_attempt_id
    RETURNING * INTO v_attempt;

    RETURN to_jsonb(v_attempt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUPABASE REALTIME CONFIGURATION
-- ============================================================================
DO $$
BEGIN
    -- Enable replication for Realtime on relevant tables
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_attempts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.violations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_settings;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
    WHEN undefined_object THEN
        NULL;
END $$;

