import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import { initialRulesContent, initialRulesVersion, recordRulesAcceptance, rulesAcceptanceError } from './rules.js';
import { requireRole } from './authorization.js';

const app = express();
const port = Number(process.env.API_PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || 'bugbash';
const jwtSecret = process.env.JWT_SECRET;
const tokenLifetime = '12h';

if (!mongoUri) throw new Error('MONGODB_URI must be configured in the server environment.');
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

app.disable('x-powered-by');
app.use(cors({ origin: process.env.APP_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '128kb' }));

const client = new MongoClient(mongoUri);
await client.connect();
const db = client.db(databaseName);
const users = db.collection('users');
const teams = db.collection('teams');
const teamSessions = db.collection('team_sessions');
const teamAttempts = db.collection('team_round_attempts');
const teamDrafts = db.collection('team_drafts');
const teamRuns = db.collection('team_code_runs');
const teamSubmissions = db.collection('team_submissions');
const testCases = db.collection('test_cases');
const competitionRules = db.collection('competition_rules');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const teamExecutionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => `team:${req.user?._id || 'unknown'}`,
});

await Promise.all([
  users.createIndex({ emailNormalized: 1 }, { unique: true, sparse: true }),
  users.createIndex({ rollNormalized: 1 }, { unique: true, sparse: true }),
  users.createIndex({ teamNameNormalized: 1 }, { unique: true, sparse: true }),
  teams.createIndex({ teamNameNormalized: 1 }, { unique: true }),
  teams.createIndex({ 'members.gmailNormalized': 1 }, { unique: true, sparse: true }),
  teamSessions.createIndex({ team_id: 1, round_id: 1 }, { unique: true }),
  teamAttempts.createIndex({ team_id: 1, round_id: 1 }, { unique: true }),
  teamDrafts.createIndex({ team_id: 1, attempt_id: 1, program_id: 1 }, { unique: true }),
  teamRuns.createIndex({ team_id: 1, created_at: -1 }),
  teamSubmissions.createIndex({ team_id: 1, attempt_id: 1, program_id: 1 }, { unique: true }),
  competitionRules.createIndex({ version: 1 }, { unique: true }),
]);

await competitionRules.updateOne(
  { version: initialRulesVersion },
  { $setOnInsert: {
    version: initialRulesVersion,
    content: initialRulesContent,
    is_active: true,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  } },
  { upsert: true },
);
const activeRules = await competitionRules.findOne({ is_active: true }, { projection: { _id: 1 } });
if (!activeRules) {
  await competitionRules.updateOne(
    { version: initialRulesVersion },
    { $set: { is_active: true } },
  );
}

const binarySearchTestCases = [
  {
    id: 'binary-search-boundary-visible-match',
    program_id: 'd1000000-0000-0000-0000-000000000001',
    input: '',
    harness: '\nprint(binary_search([1, 3, 5, 7, 9], 7))\n',
    expected_output: '3',
    is_hidden: false,
    points: 2,
    is_required: true,
  },
  {
    id: 'binary-search-boundary-visible-missing',
    program_id: 'd1000000-0000-0000-0000-000000000001',
    input: '',
    harness: '\nprint(binary_search([2, 4, 6, 8], 5))\n',
    expected_output: '-1',
    is_hidden: false,
    points: 2,
    is_required: true,
  },
  {
    id: 'binary-search-boundary-visible-single',
    program_id: 'd1000000-0000-0000-0000-000000000001',
    input: '',
    harness: '\nprint(binary_search([11], 11))\n',
    expected_output: '0',
    is_hidden: false,
    points: 2,
    is_required: true,
  },
  {
    id: 'binary-search-boundary-hidden-empty',
    program_id: 'd1000000-0000-0000-0000-000000000001',
    input: '',
    harness: '\nprint(binary_search([], 3))\n',
    expected_output: '-1',
    is_hidden: true,
    points: 2,
    is_required: true,
  },
  {
    id: 'binary-search-boundary-hidden-first',
    program_id: 'd1000000-0000-0000-0000-000000000001',
    input: '',
    harness: '\nprint(binary_search([2, 4, 6, 8], 2))\n',
    expected_output: '0',
    is_hidden: true,
    points: 2,
    is_required: true,
  },
];
const roundTwoTestCases = [
  {
    id: 'dijkstra-stale-state-shortest-path',
    program_id: 'd2000000-0000-0000-0000-000000000001',
    input: '',
    harness: `
graph = {
    "A": {"B": 4, "C": 1},
    "B": {"D": 1},
    "C": {"B": 2, "D": 8},
    "D": {},
}
print(dijkstra(graph, "A")["D"])
`,
    expected_output: '4',
    is_hidden: false,
    points: 10,
    is_required: true,
  },
  {
    id: 'dijkstra-stale-state-pruning',
    program_id: 'd2000000-0000-0000-0000-000000000001',
    input: '',
    harness: `
adjacency_scans = 0
class CountingAdjacency(dict):
    def items(self):
        global adjacency_scans
        adjacency_scans += 1
        return super().items()

node_count = 30
graph = {node: CountingAdjacency() for node in range(node_count)}
for node in range(2, node_count):
    graph[0][node] = 1000 + node
graph[0][1] = 1
for node in range(2, node_count):
    graph[1][node] = node
distances = dijkstra(graph, 0)
print(adjacency_scans <= node_count and distances[node_count - 1] == node_count)
`,
    expected_output: 'True',
    is_hidden: true,
    points: 10,
    is_required: true,
  },
  {
    id: 'lru-refreshes-accessed-key',
    program_id: 'd2000000-0000-0000-0000-000000000002',
    input: '',
    harness: `
const cache = new LRUCache(2);
cache.put(1, 1);
cache.put(2, 2);
cache.get(2);
cache.put(3, 3);
console.log(cache.get(1));
`,
    expected_output: '-1',
    is_hidden: true,
    points: 10,
    is_required: true,
  },
  {
    id: 'lru-evicts-oldest-key',
    program_id: 'd2000000-0000-0000-0000-000000000002',
    input: '',
    harness: `
const cache = new LRUCache(2);
cache.put(1, 1);
cache.put(2, 2);
cache.put(3, 3);
console.log([cache.get(1), cache.get(2)].join(","));
`,
    expected_output: '-1,2',
    is_hidden: false,
    points: 10,
    is_required: true,
  },
  {
    id: 'bst-rejects-ancestor-range-breach',
    program_id: 'd2000000-0000-0000-0000-000000000003',
    input: '',
    harness: `
root = TreeNode(10, TreeNode(5), TreeNode(15, TreeNode(6), TreeNode(20)))
print(is_valid_bst(root))
`,
    expected_output: 'False',
    is_hidden: true,
    points: 10,
    is_required: true,
  },
  {
    id: 'bst-accepts-valid-tree',
    program_id: 'd2000000-0000-0000-0000-000000000003',
    input: '',
    harness: `
root = TreeNode(8, TreeNode(3, TreeNode(1), TreeNode(6)), TreeNode(10, None, TreeNode(14)))
print(is_valid_bst(root))
`,
    expected_output: 'True',
    is_hidden: false,
    points: 10,
    is_required: true,
  },
  {
    id: 'spiral-order-rectangular-matrix',
    program_id: 'd2000000-0000-0000-0000-000000000004',
    input: '',
    harness: `
#include <iostream>
int main() {
    std::vector<std::vector<int>> matrix{{1,2,3,4},{5,6,7,8},{9,10,11,12}};
    const auto result = spiralOrder(matrix);
    for (std::size_t i = 0; i < result.size(); ++i) {
        if (i) std::cout << ",";
        std::cout << result[i];
    }
}
`,
    expected_output: '1,2,3,4,8,12,11,10,9,5,6,7',
    is_hidden: true,
    points: 10,
    is_required: true,
  },
  {
    id: 'spiral-order-single-row',
    program_id: 'd2000000-0000-0000-0000-000000000004',
    input: '',
    harness: `
#include <iostream>
int main() {
    std::vector<std::vector<int>> matrix{{1,2,3,4}};
    const auto result = spiralOrder(matrix);
    for (std::size_t i = 0; i < result.size(); ++i) {
        if (i) std::cout << ",";
        std::cout << result[i];
    }
}
`,
    expected_output: '1,2,3,4',
    is_hidden: false,
    points: 10,
    is_required: true,
  },
  {
    id: 'rate-limiter-refills-fractional-second',
    program_id: 'd2000000-0000-0000-0000-000000000005',
    input: '',
    harness_location: 'inside_class',
    harness: `
public static void main(String[] args) throws InterruptedException {
    RateLimiter limiter = new RateLimiter(1, 5.0);
    boolean first = limiter.allowRequest(1);
    limiter.lastRefillTimestamp -= 500;
    System.out.print(first + "," + limiter.allowRequest(1));
}
`,
    expected_output: 'true,true',
is_hidden: false,
    points: 20,
    is_required: true,
  },
];
const builtInTestCases = [
  ...binarySearchTestCases,
  ...roundTwoTestCases,
  {
    id: 'redis-lock-expiry-preserves-new-owner',
    program_id: 'd3000000-0000-0000-0000-000000000001',
    input: '',
    harness: `
class FakeRedis:
    def __init__(self):
        self.value = None
    def set(self, key, value, nx=False, ex=None):
        if nx and self.value is not None:
            return None
        self.value = value
        return "OK"
    def get(self, key):
        return self.value
    def delete(self, key):
        self.value = None
        return 1
    def eval(self, script, key_count, key, token):
        if self.value == token:
            self.value = None
            return 1
        return 0

redis = FakeRedis()
expired_owner = RedisDistributedLock(redis, "resource")
expired_owner.acquire()
redis.value = None
current_owner = RedisDistributedLock(redis, "resource")
current_owner.acquire()
expired_owner.release()
print(redis.get("resource") == current_owner.lock_token)
`,
    expected_output: 'True',
    is_hidden: true,
    points: 25,
    is_required: true,
  },
  {
    id: 'promise-pool-drains-after-rejection',
    program_id: 'd3000000-0000-0000-0000-000000000002',
    input: '',
    harness: `
promisePool([
  () => Promise.reject(new Error("task failed")),
  () => Promise.resolve("next"),
], 1)
  .then(results => console.log(results.map(result => result.status).join(",")))
  .catch(() => console.log("threw"));
`,
    expected_output: 'rejected,fulfilled',
    is_hidden: true,
    points: 25,
    is_required: true,
  },
  {
    id: 'promise-pool-preserves-result-order',
    program_id: 'd3000000-0000-0000-0000-000000000002',
    input: '',
    harness: `
promisePool([
  () => new Promise(resolve => setTimeout(() => resolve("slow"), 15)),
  () => Promise.resolve("fast"),
], 2).then(results => console.log(results.join(",")));
`,
    expected_output: 'slow,fast',
    is_hidden: false,
    points: 25,
    is_required: true,
  },
];
await Promise.all(builtInTestCases.map(testCase =>
  testCases.updateOne(
    { _id: testCase.id },
    { $setOnInsert: testCase },
    { upsert: true },
  )
));

const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeKey = value => normalize(value).toLocaleLowerCase('en-US');
const publicProfile = user => ({
  id: user._id.toString(),
  role: user.role,
  full_name: user.full_name,
  roll_no: user.roll_no || '',
  email: user.email || '',
  created_at: user.created_at,
});
const makeToken = user => jwt.sign({
  sub: user._id.toString(),
  ver: user.tokenVersion || 0,
}, jwtSecret, { expiresIn: tokenLifetime });
const sendToken = user => ({ token: makeToken(user), user: publicProfile(user) });

async function authenticate(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await users.findOne({ _id: payload.sub, status: { $ne: 'disabled' } });
    if (!user || payload.ver !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Authentication required.' });
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'mongodb' }));

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const identifier = normalize(req.body?.identifier);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const expectedRole = req.body?.expected_role;
  if (!identifier || !password || password.length > 128) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (expectedRole && !['admin', 'student', 'team'].includes(expectedRole)) {
    return res.status(400).json({ error: 'Invalid login request.' });
  }
  const key = normalizeKey(identifier);
  const user = await users.findOne({
    $or: [{ emailNormalized: key }, { rollNormalized: key }, { teamNameNormalized: key }],
    status: { $ne: 'disabled' },
  });
  if (!user || (expectedRole && user.role !== expectedRole) || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  return res.json(sendToken(user));
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicProfile(req.user) }));
app.post('/api/auth/logout', authenticate, async (req, res) => {
  await users.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  return res.json({ logged_out: true });
});

const arenaState = db.collection('arena_state');
const arenaStateKeys = [
  'rounds',
  'settings',
  'programs',
  'assignments',
  'attempts',
  'submissions',
  'drafts',
  'violations',
];

const isValidArenaState = state =>
  state && typeof state === 'object' && !Array.isArray(state) &&
  arenaStateKeys.every(key =>
    key === 'settings'
      ? state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])
      : Array.isArray(state[key])
  );

app.get('/api/admin/arena-state', authenticate, requireRole('admin'), async (_req, res) => {
  const saved = await arenaState.findOne({ _id: 'main' }, { projection: { _id: 0 } });
  if (!saved) return res.json({ initialized: false });
  return res.json({ initialized: true, state: saved });
});

app.post('/api/admin/arena-state/initialize', authenticate, requireRole('admin'), async (req, res) => {
  if (!isValidArenaState(req.body?.state)) return res.status(400).json({ error: 'Invalid arena state.' });
  const result = await arenaState.updateOne(
    { _id: 'main' },
    { $setOnInsert: { ...req.body.state, updated_at: new Date().toISOString() } },
    { upsert: true },
  );
  return res.json({ initialized: true, created: result.upsertedCount === 1 });
});

app.put('/api/admin/arena-state', authenticate, requireRole('admin'), async (req, res) => {
  if (!isValidArenaState(req.body?.state)) return res.status(400).json({ error: 'Invalid arena state.' });
  await arenaState.replaceOne(
    { _id: 'main' },
    { _id: 'main', ...req.body.state, updated_at: new Date().toISOString() },
    { upsert: true },
  );
  return res.json({ saved: true });
});

app.get('/api/rules/active', async (_req, res) => {
  const rule = await competitionRules.findOne({ is_active: true }, { projection: { _id: 0, version: 1, content: 1, updated_at: 1 } });
  if (!rule) return res.status(503).json({ error: 'Competition rules are not available.' });
  return res.json({ rule });
});

app.get('/api/admin/rules', authenticate, requireRole('admin'), async (_req, res) => {
  const [versions, acceptanceCounts] = await Promise.all([
    competitionRules.find({}, { projection: { _id: 0, version: 1, content: 1, is_active: 1, updated_at: 1, created_at: 1 } })
      .sort({ created_at: -1 }).toArray(),
    teams.aggregate([
      { $match: { rules_version: { $type: 'string' } } },
      { $group: { _id: '$rules_version', count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const counts = new Map(acceptanceCounts.map(item => [item._id, item.count]));
  return res.json({
    rules: versions.map(rule => ({ ...rule, accepted_teams: counts.get(rule.version) || 0 })),
  });
});

app.post('/api/admin/rules', authenticate, requireRole('admin'), async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (content.length < 100 || content.length > 100_000 || !/^##\s+.+/m.test(content)) {
    return res.status(400).json({ error: 'Rules must include section headings and contain 100–100,000 characters.' });
  }
  const latest = await competitionRules.findOne({}, { sort: { created_at: -1 }, projection: { version: 1 } });
  const latestVersion = Number(latest?.version || 0);
  if (!Number.isSafeInteger(latestVersion) || latestVersion < 1) {
    return res.status(409).json({ error: 'The current rules version is invalid; contact support.' });
  }
  const version = String(latestVersion + 1);
  const now = new Date().toISOString();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await competitionRules.updateMany({ is_active: true }, { $set: { is_active: false } }, { session });
      await competitionRules.insertOne({
        version,
        content,
        is_active: true,
        created_at: now,
        updated_at: now,
        published_by: req.user._id,
      }, { session });
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'Rules were published at the same time. Reload versions and retry.' });
    throw error;
  } finally {
    await session.endSession();
  }
  return res.status(201).json({ version });
});

app.post('/api/teams/name-availability', registrationLimiter, async (req, res) => {
  const teamName = normalize(req.body?.team_name);
  if (teamName.length < 3 || teamName.length > 30) {
    return res.status(400).json({ error: 'Team name must be 3–30 characters.' });
  }
  const exists = await teams.findOne({ teamNameNormalized: normalizeKey(teamName) }, { projection: { _id: 1 } });
  return res.json({ available: !exists });
});

app.post('/api/teams/register', registrationLimiter, async (req, res) => {
  if (rulesAcceptanceError(req.body, null) === 'missing') {
    return res.status(400).json({ error: 'All team members must accept the active competition rules before registration.' });
  }
  const activeRule = await competitionRules.findOne({ is_active: true }, { projection: { version: 1 } });
  if (rulesAcceptanceError(req.body, activeRule) === 'stale') {
    return res.status(409).json({ error: 'The competition rules have changed. Reload the current rules and confirm your acceptance again.' });
  }
  const teamName = normalize(req.body?.team_name);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const members = req.body?.members;
  if (teamName.length < 3 || teamName.length > 30 || password.length < 8 || password.length > 128 ||
      !Array.isArray(members) || members.length < 1 || members.length > 2) {
    return res.status(400).json({ error: 'Invalid registration details.' });
  }

  const cleanMembers = [];
  for (const [index, member] of members.entries()) {
    const fullName = normalize(member?.full_name);
    const className = normalize(member?.class_name);
    const department = normalize(member?.department);
    const gmail = normalize(member?.gmail).toLowerCase();
    if (fullName.length < 2 || fullName.length > 100 || !className || className.length > 100 ||
        !department || department.length > 100 || !/^[^\s@]+@gmail\.com$/i.test(gmail) || gmail.length > 254) {
      return res.status(400).json({ error: `Invalid details for member ${index + 1}.` });
    }
    cleanMembers.push({
      member_number: index + 1,
      full_name: fullName,
      class_name: className,
      department,
      gmail,
      gmailNormalized: gmail,
    });
  }
  if (new Set(cleanMembers.map(member => member.gmailNormalized)).size !== cleanMembers.length) {
    return res.status(400).json({ error: 'Members must use different Gmail addresses.' });
  }

  const teamNameNormalized = normalizeKey(teamName);
  const collision = await teams.findOne({
    $or: [{ teamNameNormalized }, { 'members.gmailNormalized': { $in: cleanMembers.map(member => member.gmailNormalized) } }],
  }, { projection: { _id: 1 } });
  if (collision) return res.status(409).json({ error: 'Team name or member email already registered.' });

  const now = new Date().toISOString();
  const teamId = crypto.randomUUID();
  const user = {
    _id: teamId,
    role: 'team',
    full_name: teamName,
    roll_no: `TEAM-${teamId.slice(0, 8).toUpperCase()}`,
    teamName,
    teamNameNormalized,
    passwordHash: await bcrypt.hash(password, 12),
    status: 'active',
    created_at: now,
  };
  const team = {
    _id: teamId,
    team_name: teamName,
    teamNameNormalized,
    status: 'active',
    members: cleanMembers,
    ...recordRulesAcceptance(activeRule.version),
    created_at: now,
  };

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await users.insertOne(user, { session });
      await teams.insertOne(team, { session });
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'Team name or member email already registered.' });
    throw error;
  } finally {
    await session.endSession();
  }
  return res.status(201).json({ registered: true });
});

app.get('/api/team/overview', authenticate, requireRole('team'), async (req, res) => {
  const team = await teams.findOne({ _id: req.user._id });
  if (!team) return res.status(404).json({ error: 'The MongoDB team profile for this login was not found. Contact an administrator.' });
  if (team.status !== 'active') return res.status(403).json({ error: 'This team account is disabled.' });
  if (!Array.isArray(team.members) || !team.members.length) {
    return res.status(409).json({ error: 'The MongoDB team registration is incomplete. Contact an administrator.' });
  }
  const savedArena = await arenaState.findOne(
    { _id: 'main' },
    { projection: { rounds: 1 } },
  );
  return res.json({
    team: { id: team._id, team_name: team.team_name, status: team.status },
    members: team.members.map(({ member_number, full_name, class_name, department }) => ({
      member_number, full_name, class: class_name, department,
    })),
    rounds: (savedArena?.rounds || []).sort((left, right) => left.round_number - right.round_number),
    attempts: await teamAttempts.find({ team_id: team._id }).toArray(),
  });
});

const claimTeamSession = async (teamId, roundId, sessionId) => {
  const savedArena = await arenaState.findOne({ _id: 'main' }, { projection: { 'settings.team_session_policy': 1 } });
  if (savedArena?.settings?.team_session_policy === 'takeover') {
    try {
      await teamSessions.updateOne(
        { team_id: teamId, round_id: roundId },
        { $set: { session_id: sessionId, heartbeat_at: new Date().toISOString() } },
        { upsert: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      await teamSessions.updateOne(
        { team_id: teamId, round_id: roundId },
        { $set: { session_id: sessionId, heartbeat_at: new Date().toISOString() } },
      );
    }
    return true;
  }
  const staleBefore = new Date(Date.now() - 45_000).toISOString();
  try {
    const result = await teamSessions.findOneAndUpdate(
      {
        team_id: teamId,
        round_id: roundId,
        $or: [
          { session_id: sessionId },
          { heartbeat_at: { $lt: staleBefore } },
          { heartbeat_at: { $exists: false } },
        ],
      },
      { $set: { session_id: sessionId, heartbeat_at: new Date().toISOString() } },
      { upsert: true, returnDocument: 'after' },
    );
    return Boolean(result);
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
};

const validateTeamSessionRequest = req => {
  const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id.trim() : '';
  return sessionId.length >= 16 && sessionId.length <= 128 ? sessionId : null;
};

const getActiveTeamExecutionContext = async (teamId, attemptId, programId, sessionId) => {
  const [team, attempt, state] = await Promise.all([
    teams.findOne({ _id: teamId, status: 'active' }, { projection: { _id: 1 } }),
    teamAttempts.findOne({ id: attemptId, team_id: teamId }),
    arenaState.findOne({ _id: 'main' }, { projection: { rounds: 1, programs: 1, assignments: 1 } }),
  ]);
  if (!team || !attempt || attempt.status !== 'in_progress' ||
      !attempt.ends_at || Date.parse(attempt.ends_at) <= Date.now()) {
    return { error: 'Round is no longer active or the program is unavailable.', status: 403 };
  }
  const round = (state?.rounds || []).find(item => item.id === attempt.round_id);
  if (!round || round.status !== 'live') {
    return { error: 'Round is no longer active.', status: 403 };
  }
  const session = await teamSessions.findOne({ team_id: teamId, round_id: round.id });
  const lastHeartbeat = Date.parse(session?.heartbeat_at || '');
  if (!session || session.round_id !== round.id || session.session_id !== sessionId ||
      !Number.isFinite(lastHeartbeat) || lastHeartbeat < Date.now() - 60_000) {
    return { error: 'This team session is no longer authorized.', status: 403 };
  }
  const program = (state?.programs || []).find(item => item.id === programId && item.round_id === round.id);
  if (!program) return { error: 'Program is unavailable.', status: 404 };
  const roundAssignments = (state?.assignments || []).filter(item =>
    item.round_id === round.id && (item.team_id === teamId || item.student_id === teamId)
  );
  if (roundAssignments.length && !roundAssignments.some(item => item.program_id === programId)) {
    return { error: 'This program is not assigned to your team.', status: 403 };
  }
  return { attempt, round, program };
};

const normalizeProgramOutput = value => value.replace(/\r\n/g, '\n').trimEnd();
const onlineCompilerApiKey = process.env.ONLINECOMPILER_API_KEY;
const compilerIds = {
  c: 'gcc-15',
  cpp: 'g++-15',
  java: 'openjdk-25',
  python: 'python-3.14',
  python3: 'python-3.14',
  javascript: 'nodejs-24',
};

const callOnlineCompiler = async (path, body, timeoutMs = 50_000) => {
  if (!onlineCompilerApiKey || onlineCompilerApiKey.startsWith('replace-with-')) {
    const error = new Error('OnlineCompiler is not configured. Add ONLINECOMPILER_API_KEY to the server .env and restart the API.');
    error.status = 503;
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.onlinecompiler.io/api/${path}`, {
      method: 'POST',
      headers: {
        Authorization: onlineCompilerApiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const responseText = await response.text();
    if (Buffer.byteLength(responseText, 'utf8') > 256 * 1024) {
      const error = new Error('OnlineCompiler returned a response that exceeded the size limit.');
      error.status = 502;
      throw error;
    }
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`OnlineCompiler returned an invalid response (${response.status}).`);
    }
    if (!response.ok) {
      const error = new Error(result.error || `OnlineCompiler request failed (${response.status}).`);
      error.status = response.status === 401 || response.status === 403 ? 502 : response.status;
      throw error;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

const runOnOnlineCompiler = (program, sourceCode, input) => {
  const compiler = compilerIds[String(program.language || '').toLowerCase()];
  if (!compiler) {
    const error = new Error('This program language is not enabled in OnlineCompiler.');
    error.status = 400;
    throw error;
  }
  return callOnlineCompiler('run-code-sync/', {
    compiler,
    code: sourceCode,
    input,
    time_limit: Math.max(0.1, Math.min(Number(program.time_limit_ms || 2_000) / 1000, 30)),
  }, 40_000);
};

app.get('/api/team/attempts/:attemptId/programs/:programId/workspace', authenticate, requireRole('team'), async (req, res) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
  const context = await getActiveTeamExecutionContext(req.user._id, req.params.attemptId, req.params.programId, sessionId);
  if (context.error) return res.status(context.status).json({ error: context.error });
  const [draft, runs] = await Promise.all([
    teamDrafts.findOne({ team_id: req.user._id, attempt_id: req.params.attemptId, program_id: req.params.programId }),
    teamRuns.find({ team_id: req.user._id, attempt_id: req.params.attemptId, program_id: req.params.programId })
      .sort({ created_at: -1 }).limit(10).toArray(),
  ]);
  return res.json({
    draft: draft ? { code: draft.code } : null,
    runs: runs.map(({ id, status, stdout, stderr, compile_errors, time_ms, memory_kb, created_at, tests_passed, tests_total, visible_test_results }) =>
      ({ id, status, stdout, stderr, compile_errors, time_ms, memory_kb, created_at, tests_passed, tests_total, visible_test_results })
    ),
  });
});

app.put('/api/team/attempts/:attemptId/programs/:programId/draft', authenticate, requireRole('team'), async (req, res) => {
  const sourceCode = typeof req.body?.code === 'string' ? req.body.code : '';
  const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id : '';
  if (Buffer.byteLength(sourceCode, 'utf8') > 65_536) return res.status(400).json({ error: 'Source code exceeds the 64 KB limit.' });
  const context = await getActiveTeamExecutionContext(req.user._id, req.params.attemptId, req.params.programId, sessionId);
  if (context.error) return res.status(context.status).json({ error: context.error });
  const updatedAt = new Date().toISOString();
  await teamDrafts.updateOne(
    { team_id: req.user._id, attempt_id: req.params.attemptId, program_id: req.params.programId },
    { $set: { code: sourceCode, updated_at: updatedAt } },
    { upsert: true },
  );
  return res.json({ saved: true, updated_at: updatedAt });
});

app.post('/api/team/execute', authenticate, requireRole('team'), teamExecutionLimiter, async (req, res) => {
  const attemptId = typeof req.body?.attempt_id === 'string' ? req.body.attempt_id : '';
  const programId = typeof req.body?.program_id === 'string' ? req.body.program_id : '';
  const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id : '';
  const sourceCode = typeof req.body?.source_code === 'string' ? req.body.source_code : '';
  const stdin = typeof req.body?.stdin === 'string' ? req.body.stdin : '';
  const mode = req.body?.mode || 'run';
  if (!attemptId || !programId || !sessionId || !['run', 'submit'].includes(mode) ||
      Buffer.byteLength(sourceCode, 'utf8') > 65_536 || Buffer.byteLength(stdin, 'utf8') > 16_384) {
    return res.status(400).json({ error: 'Invalid execution request or code/input size limit exceeded.' });
  }
  const context = await getActiveTeamExecutionContext(req.user._id, attemptId, programId, sessionId);
  if (context.error) return res.status(context.status).json({ error: context.error });
  const { attempt, program } = context;
  if (mode === 'run' && Number.isFinite(program.max_runs)) {
    const runCount = await teamRuns.countDocuments({
      team_id: req.user._id,
      attempt_id: attemptId,
      program_id: programId,
      mode: 'run',
    });
    if (runCount >= program.max_runs) return res.status(429).json({ error: 'The run limit for this program has been reached.' });
  }
  let tests = [];
  if (mode === 'submit') {
    tests = await testCases.find({ program_id: programId })
      .project({ id: 1, input: 1, expected_output: 1, harness: 1, harness_location: 1, points: 1, is_required: 1, is_hidden: 1 })
      .sort({ created_at: 1 }).toArray();
    if (!tests.length) {
      return res.status(400).json({ error: 'Secure grading tests are not configured for this program in MongoDB.' });
    }
  }

  const runId = crypto.randomUUID();
  const runRecord = {
    id: runId,
    team_id: req.user._id,
    attempt_id: attemptId,
    program_id: programId,
    source_code: sourceCode,
    mode,
    status: 'running',
    created_at: new Date().toISOString(),
  };
  await teamRuns.insertOne(runRecord);
  const presentRun = (result, extra = {}) => ({
    id: runId,
    status: result.status || 'Unknown',
    stdout: String(result.stdout || '').slice(0, 16_000),
    stderr: String(result.stderr || '').slice(0, 16_000),
    compile_errors: String(result.stderr || '').slice(0, 16_000),
    time_ms: Math.round((Number.parseFloat(result.time) || 0) * 1000),
    memory_kb: Number.parseInt(result.memory, 10) || 0,
    created_at: runRecord.created_at,
    ...extra,
  });
  try {
    let payload;
    if (mode === 'run') {
      const response = await runOnOnlineCompiler(program, sourceCode, stdin);
      const result = {
        status: Number(response.exit_code) === 0 ? 'Finished' : 'Error',
        stdout: response.output,
        stderr: response.error,
        time: response.time,
        memory: response.memory,
      };
      if (Date.parse(attempt.ends_at) <= Date.now()) return res.status(403).json({ error: 'Round expired before the run completed.' });
      const run = presentRun(result);
      await teamRuns.updateOne({ id: runId }, { $set: run });
      payload = { run };
    } else {
      const results = [];
      const visibleTestResults = [];
      for (const test of tests) {
        if (Date.parse(attempt.ends_at) <= Date.now()) {
          await teamRuns.updateOne({ id: runId }, { $set: { status: 'time_over' } });
          return res.status(403).json({ error: 'Round expired before submission completed.' });
        }
        let testSource = `${sourceCode}${typeof test.harness === 'string' && test.harness_location !== 'inside_class' ? test.harness : ''}`;
        if (test.harness_location === 'inside_class') {
          const closingBrace = testSource.lastIndexOf('}');
          if (closingBrace < 0 || typeof test.harness !== 'string') {
            return res.status(400).json({ error: 'The configured test harness is invalid for this program.' });
          }
          testSource = `${sourceCode.slice(0, closingBrace)}${test.harness}\n${sourceCode.slice(closingBrace)}`;
        }
        if (Buffer.byteLength(testSource, 'utf8') > 65_536) {
          return res.status(400).json({ error: 'The submitted code and test harness exceed the source size limit.' });
        }
        const response = await runOnOnlineCompiler(program, testSource, String(test.input || ''));
        const result = {
          passedExecution: Number(response.exit_code) === 0,
          stdout: String(response.output || '').slice(0, 16_000),
          stderr: String(response.error || '').slice(0, 16_000),
          time: response.time,
          memory: response.memory,
        };
        const passed = result.passedExecution &&
          normalizeProgramOutput(result.stdout) === normalizeProgramOutput(String(test.expected_output || ''));
        if (!test.is_hidden) {
          visibleTestResults.push({
            test_number: visibleTestResults.length + 1,
            passed,
            expected_output: String(test.expected_output || '').slice(0, 16_000),
            actual_output: result.stdout,
            error: result.stderr,
          });
        }
        results.push({
          passed,
          points: Number(test.points || 0),
          is_required: Boolean(test.is_required),
        });
      }
      if (Date.parse(attempt.ends_at) <= Date.now()) {
        await teamRuns.updateOne({ id: runId }, { $set: { status: 'time_over' } });
        return res.status(403).json({ error: 'Round expired before submission completed.' });
      }
      const testsPassed = results.filter(result => result.passed).length;
      const testsTotal = results.length;
      const requiredTests = results.filter(result => result.is_required);
      const solved = requiredTests.length > 0 && requiredTests.every(result => result.passed);
      const score = results.reduce((sum, result) => sum + (result.passed ? result.points : 0), 0);
      const firstVisibleFailure = visibleTestResults.find(result => !result.passed);
      const run = presentRun({
        stdout: visibleTestResults[0]?.actual_output || '',
        stderr: firstVisibleFailure?.error || '',
      }, {
        status: solved ? 'Accepted' : 'Tests Failed',
        visible_test_results: visibleTestResults,
        tests_passed: testsPassed,
        tests_total: testsTotal,
      });
      await teamRuns.updateOne({ id: runId }, { $set: run });
      if (solved) {
        await teamSubmissions.updateOne(
          { team_id: req.user._id, attempt_id: attemptId, program_id: programId },
          { $set: {
            id: crypto.randomUUID(),
            team_id: req.user._id,
            attempt_id: attemptId,
            round_id: attempt.round_id,
            program_id: programId,
            code: sourceCode,
            score,
            tests_passed: testsPassed,
            tests_total: testsTotal,
            final_status: 'solved',
            submitted_at: new Date().toISOString(),
          } },
          { upsert: true },
        );
      }
      payload = {
        run,
        tests_passed: testsPassed,
        tests_total: testsTotal,
        visible_test_results: visibleTestResults,
        score,
        final_status: solved ? 'solved' : 'incomplete',
        submission_recorded: solved,
      };
    }
    return res.json(payload);
  } catch (error) {
    await teamRuns.updateOne({ id: runId }, { $set: { status: error.status === 413 ? 'output_limit' : 'engine_error' } });
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('OnlineCompiler execution failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(502).json({ error: 'OnlineCompiler could not execute the program. Check the API key and provider status, then try again.' });
  }
});

app.get('/api/team/rounds/:roundId', authenticate, requireRole('team'), async (req, res) => {
  const savedArena = await arenaState.findOne({ _id: 'main' }, { projection: { rounds: 1, programs: 1, assignments: 1 } });
  if (!savedArena) return res.status(503).json({ error: 'The arena has not been initialized by an administrator.' });
  const round = (savedArena.rounds || []).find(item => item.id === req.params.roundId);
  if (!round) return res.status(404).json({ error: 'Round not found.' });
  const teamAssignments = (savedArena.assignments || [])
    .filter(item => item.round_id === round.id && (item.team_id === req.user._id || item.student_id === req.user._id))
    .sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER));
  const assignedProgramIds = new Set(teamAssignments.map(item => item.program_id));
  const roundPrograms = (savedArena.programs || []).filter(program =>
    program.round_id === round.id && (!assignedProgramIds.size || assignedProgramIds.has(program.id))
  );
  const savedAttempt = await teamAttempts.findOne({ team_id: req.user._id, round_id: round.id });
  const submissions = savedAttempt
    ? await teamSubmissions.find(
        { team_id: req.user._id, attempt_id: savedAttempt.id, final_status: 'solved' },
        { projection: { _id: 0, program_id: 1, final_status: 1, tests_passed: 1, tests_total: 1, score: 1 } },
      ).toArray()
    : [];
  return res.json({
    round,
    programs: roundPrograms.map(program => ({
      id: program.id,
      round_id: program.round_id,
      title: program.title,
      language: program.language,
      description: program.description,
      buggy_code: program.buggy_code,
      points: program.points,
      time_limit_ms: program.time_limit_ms || 2000,
    })),
    attempt: savedAttempt,
    submissions,
  });
});

app.post('/api/team/rounds/:roundId/session', authenticate, requireRole('team'), async (req, res) => {
  const sessionId = validateTeamSessionRequest(req);
  if (!sessionId) return res.status(400).json({ error: 'A valid session identifier is required.' });
  const round = await arenaState.findOne({ _id: 'main', rounds: { $elemMatch: { id: req.params.roundId, status: 'live' } } }, { projection: { _id: 1 } });
  if (!round) return res.status(409).json({ error: 'This round is not currently live.' });
  if (!(await claimTeamSession(req.user._id, req.params.roundId, sessionId))) {
    return res.status(409).json({ error: 'Another device already has this team round open.' });
  }
  return res.json({ claimed: true });
});

app.post('/api/team/rounds/:roundId/start', authenticate, requireRole('team'), async (req, res) => {
  const sessionId = validateTeamSessionRequest(req);
  if (!sessionId) return res.status(400).json({ error: 'A valid session identifier is required.' });
  const state = await arenaState.findOne({ _id: 'main' }, { projection: { rounds: 1 } });
  const round = (state?.rounds || []).find(item => item.id === req.params.roundId);
  if (!round) return res.status(404).json({ error: 'Round not found.' });
  if (round.status !== 'live') return res.status(409).json({ error: 'This round is not currently live.' });
  if (!(await claimTeamSession(req.user._id, round.id, sessionId))) {
    return res.status(409).json({ error: 'Another device already has this team round open.' });
  }
  const now = new Date();
  const attempt = {
    id: crypto.randomUUID(),
    team_id: req.user._id,
    round_id: round.id,
    started_at: now.toISOString(),
    ends_at: new Date(now.getTime() + round.duration_minutes * 60_000).toISOString(),
    completed_at: null,
    status: 'in_progress',
    warnings_count: 0,
  };
  try {
    await teamAttempts.insertOne(attempt);
    return res.status(201).json({ attempt });
  } catch (error) {
    await teamSessions.deleteOne({ team_id: req.user._id, round_id: round.id, session_id: sessionId });
    if (error?.code === 11000) return res.status(409).json({ error: 'This team has already started this round.' });
    throw error;
  }
});

app.post('/api/team/rounds/:roundId/heartbeat', authenticate, requireRole('team'), async (req, res) => {
  const sessionId = validateTeamSessionRequest(req);
  if (!sessionId) return res.status(400).json({ error: 'A valid session identifier is required.' });
  const result = await teamSessions.updateOne(
    { team_id: req.user._id, round_id: req.params.roundId, session_id: sessionId },
    { $set: { heartbeat_at: new Date().toISOString() } },
  );
  if (!result.matchedCount) return res.status(409).json({ error: 'This session is no longer active on this device.' });
  return res.json({ active: true });
});

app.post('/api/team/attempts/:attemptId/finalize', authenticate, requireRole('team'), async (req, res) => {
  const attempt = await teamAttempts.findOne({ id: req.params.attemptId, team_id: req.user._id });
  if (!attempt) return res.status(404).json({ error: 'Round attempt not found.' });
  if (attempt.status !== 'in_progress') return res.json({ attempt });
  const completed = {
    ...attempt,
    status: 'time_over',
    completed_at: new Date().toISOString(),
  };
  await teamAttempts.replaceOne({ id: attempt.id, team_id: req.user._id }, completed);
  await teamSessions.deleteOne({ team_id: req.user._id, round_id: attempt.round_id });
  return res.json({ attempt: completed });
});

app.get('/api/admin/teams', authenticate, requireRole('admin'), async (_req, res) => {
  const rows = await teams.find({}, {
    projection: {
      _id: 1,
      team_name: 1,
      status: 1,
      created_at: 1,
      rules_version: 1,
      rules_accepted_at: 1,
      'members.member_number': 1,
      'members.full_name': 1,
      'members.class_name': 1,
      'members.department': 1,
      'members.gmail': 1,
    },
  })
    .sort({ created_at: -1 }).toArray();
  return res.json({ teams: rows });
});

app.patch('/api/admin/teams/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['active', 'disabled'].includes(status)) return res.status(400).json({ error: 'Invalid team status.' });
  const result = await teams.updateOne({ _id: req.params.id }, { $set: { status } });
  if (!result.matchedCount) return res.status(404).json({ error: 'Team not found.' });
  await users.updateOne({ _id: req.params.id }, { $set: { status } });
  return res.json({ updated: true });
});

app.patch('/api/admin/teams/:id/password', authenticate, requireRole('admin'), async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 12–128 characters.' });
  }
  const result = await users.updateOne(
    { _id: req.params.id, role: 'team' },
    { $set: { passwordHash: await bcrypt.hash(password, 12) } },
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Team not found.' });
  return res.json({ reset: true });
});

app.get('/api/admin/teams/:id', authenticate, requireRole('admin'), async (req, res) => {
  const team = await teams.findOne({ _id: req.params.id }, {
    projection: {
      _id: 1,
      team_name: 1,
      status: 1,
      created_at: 1,
      rules_version: 1,
      rules_accepted_at: 1,
      'members.member_number': 1,
      'members.full_name': 1,
      'members.class_name': 1,
      'members.department': 1,
      'members.gmail': 1,
    },
  });
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  const [attempts, submissions, runs, savedArena] = await Promise.all([
    teamAttempts.find({ team_id: team._id }).toArray(),
    teamSubmissions.find({ team_id: team._id }).sort({ submitted_at: -1 }).toArray(),
    teamRuns.find({ team_id: team._id }).project({ source_code: 0 }).sort({ created_at: -1 }).limit(50).toArray(),
    arenaState.findOne({ _id: 'main' }, { projection: { programs: 1, assignments: 1, violations: 1 } }),
  ]);
  const programs = savedArena?.programs || [];
  const programById = new Map(programs.map(program => [program.id, program]));
  const roundIds = new Set(attempts.map(attempt => attempt.round_id));
  const roundResults = [...roundIds].map(roundId => {
    const roundSubmissions = submissions.filter(submission => submission.round_id === roundId);
    return {
      round_id: roundId,
      score: roundSubmissions.reduce((sum, submission) =>
        sum + Number(submission.manual_score ?? submission.score ?? 0), 0),
      programs_solved: roundSubmissions.length,
      total_time_ms: runs
        .filter(run => attempts.some(attempt => attempt.id === run.attempt_id && attempt.round_id === roundId))
        .reduce((sum, run) => sum + Number(run.time_ms || 0), 0),
    };
  });
  const teamAssignments = (savedArena?.assignments || []).filter(item =>
    item.team_id === team._id || item.student_id === team._id,
  );
  return res.json({
    team,
    members: (team.members || []).map(member => ({
      id: `${team._id}-${member.member_number}`,
      member_number: member.member_number,
      full_name: member.full_name,
      class: member.class_name,
      department: member.department,
      gmail: member.gmail,
    })),
    submissions: submissions.map(submission => ({
      ...submission,
      manual_score: submission.manual_score ?? null,
      manual_review_notes: submission.manual_review_notes ?? null,
      programs: programById.has(submission.program_id)
        ? [{ title: programById.get(submission.program_id).title, buggy_code: programById.get(submission.program_id).buggy_code }]
        : [],
    })),
    runs,
    violations: (savedArena?.violations || []).filter(item =>
      item.team_id === team._id || item.student_id === team._id,
    ),
    assignments: teamAssignments,
    results: roundResults,
  });
});

app.get('/api/admin/leaderboard', authenticate, requireRole('admin'), async (_req, res) => {
  const [teamRows, submissionRows] = await Promise.all([
    teams.find({}, { projection: { _id: 1, team_name: 1 } }).toArray(),
    teamSubmissions.find({}, { projection: { team_id: 1, score: 1 } }).toArray(),
  ]);
  const scores = new Map();
  for (const submission of submissionRows) {
    scores.set(submission.team_id, (scores.get(submission.team_id) || 0) +
      Number(submission.manual_score ?? submission.score ?? 0));
  }
  const leaderboard = teamRows
    .map(team => ({ team_name: team.team_name, score: scores.get(team._id) || 0 }))
    .sort((left, right) => right.score - left.score || left.team_name.localeCompare(right.team_name))
    .map((team, index) => ({ ...team, rank: index + 1 }));
  return res.json({ leaderboard });
});

app.get('/api/admin/programs/:programId/test-cases', authenticate, requireRole('admin'), async (req, res) => {
  const rows = await testCases.find({ program_id: req.params.programId })
    .project({ id: 1, input: 1, expected_output: 1, is_hidden: 1, points: 1, is_required: 1 })
    .sort({ created_at: 1 })
    .toArray();
  return res.json({ test_cases: rows });
});

app.post('/api/admin/programs/:programId/test-cases', authenticate, requireRole('admin'), async (req, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input : null;
  const expectedOutput = typeof req.body?.expected_output === 'string' ? req.body.expected_output : null;
  const points = Number(req.body?.points);
  if (input === null || expectedOutput === null || !Number.isFinite(points) || points < 0 ||
      typeof req.body?.is_hidden !== 'boolean' || typeof req.body?.is_required !== 'boolean') {
    return res.status(400).json({ error: 'Enter valid input, expected output, points, and test visibility.' });
  }
  const savedArena = await arenaState.findOne({ _id: 'main' }, { projection: { 'programs.id': 1 } });
  if (!savedArena?.programs?.some(program => program.id === req.params.programId)) {
    return res.status(404).json({ error: 'Program not found.' });
  }
  const testCase = {
    id: crypto.randomUUID(),
    program_id: req.params.programId,
    input,
    expected_output: expectedOutput,
    is_hidden: req.body.is_hidden,
    is_required: req.body.is_required,
    points,
    created_at: new Date().toISOString(),
  };
  await testCases.insertOne(testCase);
  return res.status(201).json({ test_case: testCase });
});

app.delete('/api/admin/test-cases/:id', authenticate, requireRole('admin'), async (req, res) => {
  const result = await testCases.deleteOne({ id: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ error: 'Test case not found.' });
  return res.json({ deleted: true });
});

app.patch('/api/admin/submissions/:id/review', authenticate, requireRole('admin'), async (req, res) => {
  const score = Number(req.body?.manual_score);
  const notes = typeof req.body?.manual_review_notes === 'string' ? req.body.manual_review_notes : '';
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000 || notes.length > 10_000) {
    return res.status(400).json({ error: 'Enter a valid non-negative score and review notes under 10,000 characters.' });
  }
  const result = await teamSubmissions.updateOne(
    { id: req.params.id },
    { $set: { manual_score: score, manual_review_notes: notes, reviewed_at: new Date().toISOString(), reviewed_by: req.user._id } },
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Submission not found.' });
  return res.json({ reviewed: true });
});

app.delete('/api/admin/teams/:id/rounds/:roundId/session', authenticate, requireRole('admin'), async (req, res) => {
  const result = await teamSessions.deleteOne({ team_id: req.params.id, round_id: req.params.roundId });
  return res.json({ released: result.deletedCount > 0 });
});

app.post('/api/admin/teams/:id/assignments', authenticate, requireRole('admin'), async (req, res) => {
  const team = await teams.findOne({ _id: req.params.id }, { projection: { _id: 1 } });
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  const programId = typeof req.body?.program_id === 'string' ? req.body.program_id : '';
  const savedArena = await arenaState.findOne({ _id: 'main' }, { projection: { programs: 1 } });
  const program = savedArena?.programs?.find(item => item.id === programId);
  if (!program) return res.status(404).json({ error: 'Program not found.' });
  const assignment = {
    id: crypto.randomUUID(),
    student_id: team._id,
    team_id: team._id,
    program_id: program.id,
    round_id: program.round_id,
  };
  await arenaState.updateOne(
    {
      _id: 'main',
      assignments: {
        $not: {
          $elemMatch: {
            $or: [{ team_id: team._id }, { student_id: team._id }],
            program_id: program.id,
          },
        },
      },
    },
    { $push: { assignments: assignment } },
  );
  return res.json({ assigned: true });
});

app.patch('/api/admin/programs/:programId/limits', authenticate, requireRole('admin'), async (req, res) => {
  const timeLimit = Number(req.body?.time_limit_ms);
  const memoryLimit = Number(req.body?.memory_limit_kb);
  const maxRunsValue = req.body?.max_runs;
  const maxRuns = maxRunsValue === null || maxRunsValue === '' ? null : Number(maxRunsValue);
  if (!Number.isInteger(timeLimit) || timeLimit < 100 || timeLimit > 30_000 ||
      !Number.isInteger(memoryLimit) || memoryLimit < 16_384 || memoryLimit > 1_048_576 ||
      (maxRuns !== null && (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 10_000))) {
    return res.status(400).json({ error: 'Compiler limits are outside the allowed range.' });
  }
  const result = await arenaState.updateOne(
    { _id: 'main', 'programs.id': req.params.programId },
    { $set: {
      'programs.$.time_limit_ms': timeLimit,
      'programs.$.memory_limit_kb': memoryLimit,
      'programs.$.max_runs': maxRuns,
    } },
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Program not found.' });
  return res.json({ saved: true });
});

app.patch('/api/admin/arena-settings/team-session-policy', authenticate, requireRole('admin'), async (req, res) => {
  const policy = req.body?.policy;
  if (!['block', 'takeover'].includes(policy)) return res.status(400).json({ error: 'Invalid active device policy.' });
  const result = await arenaState.updateOne(
    { _id: 'main' },
    { $set: { 'settings.team_session_policy': policy } },
  );
  if (!result.matchedCount) return res.status(503).json({ error: 'The arena has not been initialized.' });
  return res.json({ saved: true });
});

const normalizeStudentInput = input => {
  const fullName = normalize(input?.full_name);
  const rollNo = normalize(input?.roll_no);
  const email = normalize(input?.email).toLowerCase();
  if (fullName.length < 2 || fullName.length > 100 ||
      rollNo.length < 1 || rollNo.length > 50 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return null;
  }
  return {
    full_name: fullName,
    roll_no: rollNo,
    email,
    rollNormalized: normalizeKey(rollNo),
    emailNormalized: email,
  };
};

const createStudentAccount = async student => {
  const initialPassword = crypto.randomBytes(12).toString('base64url');
  const user = {
    _id: crypto.randomUUID(),
    role: 'student',
    ...student,
    passwordHash: await bcrypt.hash(initialPassword, 12),
    status: 'active',
    created_at: new Date().toISOString(),
  };
  await users.insertOne(user);
  return { student: publicProfile(user), initial_password: initialPassword };
};

app.get('/api/admin/students', authenticate, requireRole('admin'), async (_req, res) => {
  const rows = await users.find({ role: 'student' })
    .project({ passwordHash: 0, emailNormalized: 0, rollNormalized: 0, tokenVersion: 0 })
    .sort({ created_at: -1 })
    .toArray();
  return res.json({ students: rows.map(publicProfile) });
});

app.post('/api/admin/students', authenticate, requireRole('admin'), async (req, res) => {
  const student = normalizeStudentInput(req.body);
  if (!student) return res.status(400).json({ error: 'Enter a valid name, roll number, and email.' });
  try {
    const result = await createStudentAccount(student);
    return res.status(201).json(result);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That student email or roll number is already registered.' });
    throw error;
  }
});

app.post('/api/admin/students/import', authenticate, requireRole('admin'), async (req, res) => {
  const input = req.body?.students;
  if (!Array.isArray(input) || input.length < 1 || input.length > 500) {
    return res.status(400).json({ error: 'Import between 1 and 500 students at a time.' });
  }
  const normalized = input.map(normalizeStudentInput);
  if (normalized.some(student => !student)) {
    return res.status(400).json({ error: 'Every row needs a valid name, roll number, and email.' });
  }
  const emailKeys = normalized.map(student => student.emailNormalized);
  const rollKeys = normalized.map(student => student.rollNormalized);
  if (new Set(emailKeys).size !== emailKeys.length || new Set(rollKeys).size !== rollKeys.length) {
    return res.status(409).json({ error: 'The import contains duplicate student emails or roll numbers.' });
  }
  const existing = await users.findOne({
    role: 'student',
    $or: [{ emailNormalized: { $in: emailKeys } }, { rollNormalized: { $in: rollKeys } }],
  }, { projection: { _id: 1 } });
  if (existing) return res.status(409).json({ error: 'One or more students are already registered.' });

  const created = [];
  try {
    for (const student of normalized) created.push(await createStudentAccount(student));
  } catch (error) {
    if (created.length) {
      await users.deleteMany({ _id: { $in: created.map(item => item.student.id) } });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'One or more students are already registered.' });
    throw error;
  }
  return res.status(201).json({ students: created });
});

app.patch('/api/admin/students/:id', authenticate, requireRole('admin'), async (req, res) => {
  const student = normalizeStudentInput(req.body);
  if (!student) return res.status(400).json({ error: 'Enter a valid name, roll number, and email.' });
  try {
    const result = await users.findOneAndUpdate(
      { _id: req.params.id, role: 'student' },
      { $set: student },
      { returnDocument: 'after', projection: { passwordHash: 0, emailNormalized: 0, rollNormalized: 0 } },
    );
    if (!result) return res.status(404).json({ error: 'Student not found.' });
    return res.json({ student: publicProfile(result) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That student email or roll number is already in use.' });
    throw error;
  }
});

app.use((error, _req, res, _next) => {
  console.error('API request failed:', error);
  return res.status(500).json({ error: 'The service could not complete the request.' });
});

const initialAdminEmail = normalize(process.env.INITIAL_ADMIN_EMAIL).toLowerCase();
const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || '';
if (initialAdminPassword === 'replace-with-a-strong-password') {
  throw new Error('Replace INITIAL_ADMIN_PASSWORD in .env before starting the API.');
}
if (initialAdminEmail && initialAdminPassword) {
  const initialAdminRoll = normalize(process.env.INITIAL_ADMIN_ROLL || 'ADMIN-001');
  const rollNormalized = normalizeKey(initialAdminRoll);
  const existingEmail = await users.findOne({ emailNormalized: initialAdminEmail });
  if (existingEmail && existingEmail.role !== 'admin') {
    throw new Error('INITIAL_ADMIN_EMAIL is already assigned to a non-admin account.');
  }

  const existingAdmin = existingEmail || await users.findOne({
    role: 'admin',
    rollNormalized,
  });
  if (existingAdmin && existingAdmin.emailNormalized !== initialAdminEmail) {
    await users.updateOne(
      { _id: existingAdmin._id, role: 'admin' },
      {
        $set: {
          full_name: process.env.INITIAL_ADMIN_NAME || 'Chief Proctor',
          roll_no: initialAdminRoll,
          rollNormalized,
          email: initialAdminEmail,
          emailNormalized: initialAdminEmail,
          passwordHash: await bcrypt.hash(initialAdminPassword, 12),
        },
      },
    );
    console.info('Existing initial administrator account updated from environment settings.');
  } else if (!existingAdmin) {
    const id = crypto.randomUUID();
    await users.insertOne({
      _id: id,
      role: 'admin',
      full_name: process.env.INITIAL_ADMIN_NAME || 'Chief Proctor',
      roll_no: initialAdminRoll,
      email: initialAdminEmail,
      emailNormalized: initialAdminEmail,
      rollNormalized,
      passwordHash: await bcrypt.hash(initialAdminPassword, 12),
      status: 'active',
      created_at: new Date().toISOString(),
    });
    console.info('Initial administrator account created.');
  }
}

app.listen(port, () => console.info(`MongoDB API listening on port ${port}.`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await client.close();
    process.exit(0);
  });
}
