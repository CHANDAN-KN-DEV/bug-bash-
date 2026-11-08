# Team portals and compiler verification

Run against a non-production environment with the MongoDB API and OnlineCompiler.io configured. For the optional legacy Supabase flow, deploy the Edge Functions with `ONLINECOMPILER_API_KEY` set as a server-side secret. Never run untrusted source on the Vite server.

## Team registration and authentication

- [ ] Register a team name, then try the same name with different capitalization and whitespace; availability and server-side signup reject the duplicate.
- [ ] Register a solo team with **Participating individually** enabled; one member row is created.
- [ ] Register a two-member team; both member rows and the Auth identity are created together.
- [ ] Reject a non-Gmail address, repeated member Gmail, and a Gmail already used by another team.
- [ ] Reject password below 8 characters and a password confirmation mismatch; verify show/hide and keyboard navigation.
- [ ] Sign in using team name + password. An invalid team name and an invalid password both return `Invalid team name or password`.
- [ ] Verify failed login rate limiting and that passwords/internal Auth email are never returned or written to application logs.
- [ ] Confirm `/admin/login` and `/team/login` are separate routes; a team token cannot access `/admin/dashboard` and a student/admin token cannot access `/team/dashboard`.
- [ ] Create the admin account manually in Supabase Auth and set `profiles.role='admin'`; public team registration never creates an admin.

## RLS and team isolation

- [ ] As Team A, query teams, members, assigned programs, drafts, submissions, results, and code runs; only Team A data is returned.
- [ ] As Team A, query another team or unassigned program by UUID; no row is returned.
- [ ] As a team token, attempt direct INSERT/UPDATE/DELETE on `code_runs`; PostgreSQL denies writes.
- [ ] As a team token, query hidden `test_cases`; hidden rows are not returned. Visible cases for assigned programs are readable.
- [ ] As a team token, query `program_solutions`; no reference solution is exposed.
- [ ] Read `leaderboard`; it exposes only `team_name`, `score`, and `rank`.
- [ ] Confirm unauthenticated callers cannot invoke the run reservation RPC, registration transaction RPC, login-rate RPCs, or password reset.

## Shared round, anti-cheat, and admin

- [ ] Start a live round as a team; both members using that account observe the same attempt and server-derived `ends_at`.
- [ ] Open a round from the team dashboard; fullscreen is requested, and attempting to exit offers stay-in-fullscreen or confirm-exit choices.
- [ ] Sign in from a second device during a current session; the default policy blocks it. Set the admin policy to takeover and verify a new session invalidates the first.
- [ ] Verify one run cap and the per-minute run limit are enforced by the server, not just the UI.
- [ ] Trigger tab switch, window blur, and fullscreen-exit violations; verify the attempt is terminated and logs are associated with the team and timestamp.
- [ ] Wait for expiry; the editor locks, `Time Over` is shown, saved drafts are submitted, and the server rejects additional runs.
- [ ] As admin, search/filter teams, inspect members, assignments, submissions/diffs, runs, violations, and results; enable/disable, assign programs, reset password, and allow re-entry.
- [ ] Verify leaderboard updates via Realtime and CSV contains team names only.

## Compiler security and grading

- [ ] Run a valid C, C++, Java, and Python 3 sample with custom stdin; language is fixed by the assigned program.
- [ ] Submit a compile error; diagnostics appear in Compile Errors and the corresponding Monaco line is highlighted.
- [ ] Run an infinite loop; OnlineCompiler.io enforces the configured time limit and returns a timeout/error result.
- [ ] Verify memory and output limits; simulate engine crash/unavailability and confirm an explicit error (not a success-shaped response).
- [ ] Submit a solution that passes visible tests and fails a hidden test; score/final status reflect the complete test set while hidden inputs/outputs never reach the browser.
- [ ] Submit each built-in Round 2 program; verify MongoDB startup seeding provides grading tests and no "tests are not configured" error appears.
- [ ] Submit once all required tests pass; verify `tests_passed`, `tests_total`, score, solved count, and leaderboard update.
- [ ] Submit code that fails a required test; show **Needs fixes** without writing an incomplete final submission, then verify the same program can be corrected and accepted on a later submit.
- [ ] Verify a solved program is marked **Corrected** in the team program list and a failed submission is marked **Needs fixes**.
- [ ] After expiry or termination, call the active execution endpoint directly with a valid token; the request is rejected before OnlineCompiler.io receives code.

## Legacy regression

- [ ] Run the existing 3-round student flow end-to-end: login, assignment visibility, server timer, autosave, submit, expiry auto-submit, violations, termination, admin re-entry, live monitor, results, and CSV.
- [ ] Confirm the existing legacy JavaScript tasks still work in the original portal.
