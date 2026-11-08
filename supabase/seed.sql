-- Optional compiler fixtures for a self-contained Round 1 compiler example.
-- Team accounts and admins must be created through Auth / the registration
-- Edge Function; never seed a reusable password or a service-role credential.
INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
VALUES (
  'd1000000-0000-0000-0000-000000000011',
  'c1111111-1111-1111-1111-111111111111',
  'Team Compiler Smoke Test',
  'python',
  'Read two integers from stdin and print their sum.',
  E'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a - b)  # Deliberate bug: subtraction instead of addition',
  10
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.test_cases (id, program_id, input, expected_output, is_hidden, points, is_required)
VALUES
  ('e1000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000011', '4 2', '6', false, 5, true),
  ('e1000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000011', '-3 8', '5', true, 5, true)
ON CONFLICT (id) DO NOTHING;

-- Existing Auth student profiles are migrated to one-member legacy teams.
-- Register additional sample teams at /register so Auth credentials are managed
-- by Supabase and Gmail uniqueness is validated by the same production path.
