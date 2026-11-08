export const initialRulesVersion = '1';

export function rulesAcceptanceError(body, activeRule) {
  const version = typeof body?.rules_version === 'string' ? body.rules_version.trim() : '';
  if (body?.rules_accepted !== true || !version) return 'missing';
  return !activeRule || activeRule.version !== version ? 'stale' : null;
}

export function recordRulesAcceptance(version, acceptedAt = new Date()) {
  return {
    rules_version: version,
    rules_accepted_at: acceptedAt.toISOString(),
  };
}

export const initialRulesContent = `## A. Eligibility and Teams
1. Teams may have 1 or 2 members. Solo participation is allowed.
2. Every participant must be a currently enrolled student of Rajarajeswari College of Engineering.
3. Team names must be unique and appropriate. Offensive or misleading names will be rejected or renamed by the organizers.
4. Registered details (names, class, department, Gmail) must be accurate. Fake or duplicate registrations will lead to disqualification.
5. Team members cannot be changed after registration unless the admin approves.
6. One person can belong to only one team.

## B. Competition Format
1. The competition has three rounds of 30 minutes each: Round 1 (10 programs), Round 2 (5 programs), Round 3 (1 or 2 programs).
2. Teams must find and fix the bugs in every assigned program. Assigned programs may differ between teams.
3. Each round has a fixed time limit. The timer starts when the team clicks "Start Round" and cannot be paused or reset.
4. When time ends, the system shows "Time Over", locks the editor, and automatically submits the latest saved code. Programs not submitted are marked incomplete.
5. The top 50% of teams advance from Round 1 to Round 2, ranked by programs solved and then least total time. The top 5 teams advance from Round 2 to Round 3. The admin sets the exact qualifying count before each round starts.
6. Round 1 is scheduled for 23 November 2026. The final results will be announced on 15 December 2026. The organizers will announce the venue and remaining schedule.

## C. Scoring and Ranking
1. Programs are graded using visible and hidden test cases. A program counts as solved only when all required tests pass.
2. Ranking is decided by total programs solved, then least total time, then fewest failed test runs (wrong answers and compile errors) across submitted programs. Remaining ties are broken by fewer anti-cheating warnings, then by the organizers.
3. The leaderboard shows team names only.
4. The organizers' decision is final in case of disputes.

## D. Using the Platform
1. Both members share one team account and one session. Only one active login per team is allowed during a round.
2. Use only the built-in code editor and compiler. External compilers, IDEs, or other tools are not allowed.
3. Run your code as often as needed, subject to the run limit set by the admin. Final marks come from submitted code only.
4. Keep the Team ID and password confidential. Teams are responsible for all activity under their account.
5. A stable internet connection is the team's responsibility. Time lost due to connectivity problems will not be added back unless the admin decides otherwise.

## E. Fair Play and Anti-Cheating
1. The round must be taken in fullscreen mode in the same browser window.
2. Leaving the competition page is monitored. Switching tabs or windows, minimizing the browser, exiting fullscreen, or losing focus will automatically terminate the current round and be recorded with the team's details and timestamp.
3. A terminated team cannot re-enter the round unless the admin explicitly allows it.
4. Copying code from other teams, sharing solutions, using AI tools, searching the internet, or getting outside help during a round is strictly prohibited.
5. Copy, paste, and right-click may be restricted inside the exam area.
6. Attempts to tamper with the timer, bypass restrictions, attack the platform, or access other teams' data lead to immediate disqualification and may be reported to the institution.
7. The system detects browser-level activity only. Organizers may also use physical invigilation, and violations noticed by invigilators are treated the same way.

## F. Technical Issues
1. If a technical problem occurs, contact Riya at 8660876267 immediately. Do not refresh repeatedly or reopen the round without permission.
2. Refreshing the page resumes the same round with the correct remaining time, but repeated suspicious refreshes may be reviewed.
3. Organizers may pause, stop, or restart a round for technical reasons.

## G. Conduct and Disqualification
1. Participants must behave respectfully toward organizers, volunteers, and other teams.
2. Violation of any rule may lead to a warning, round termination, score deduction, or disqualification at the organizers' discretion.
3. Organizers may update the rules before or during the event with notice, and the active version applies.

## H. Privacy and Data
1. Registration details are used only to run the competition and contact participants.
2. Submissions, code runs, violations, and timestamps are recorded and visible to the organizers.
3. Final results will be announced after the last round on 15 December 2026 and shown on the team leaderboard. Only team names, ranks, and scores will be published; members' personal details will not be made public. Photographs and videos may be used for event promotion and social media. Teams who do not want their photos published can inform the organizers at the event.`;

export function parseRuleSections(content) {
  const sections = [];
  let current = null;
  for (const line of String(content || '').split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { title: heading[1].trim(), items: [] };
      sections.push(current);
    } else if (current && line.trim()) {
      current.items.push(line.replace(/^\d+\.\s*/, '').trim());
    }
  }
  return sections;
}
