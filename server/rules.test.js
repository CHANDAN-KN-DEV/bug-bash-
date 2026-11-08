import assert from 'node:assert/strict';
import test from 'node:test';
import { requireRole } from './authorization.js';
import { recordRulesAcceptance, rulesAcceptanceError } from './rules.js';

test('registration requires an explicit rules acceptance flag and version', () => {
  assert.equal(rulesAcceptanceError({}, null), 'missing');
  assert.equal(rulesAcceptanceError({ rules_version: '1' }, null), 'missing');
  assert.equal(rulesAcceptanceError({ rules_accepted: true }, null), 'missing');
});

test('registration rejects acceptance of a version that is no longer active', () => {
  assert.equal(
    rulesAcceptanceError({ rules_accepted: true, rules_version: '1' }, { version: '2' }),
    'stale',
  );
  assert.equal(
    rulesAcceptanceError({ rules_accepted: true, rules_version: '2' }, { version: '2' }),
    null,
  );
});

test('acceptance timestamp is generated server-side and ignores client timestamps', () => {
  const serverTime = new Date('2026-11-08T12:00:00.000Z');
  const acceptance = recordRulesAcceptance('2', serverTime);
  assert.deepEqual(acceptance, {
    rules_version: '2',
    rules_accepted_at: '2026-11-08T12:00:00.000Z',
  });
  assert.equal('rules_accepted_at' in acceptance, true);
});

test('team users are denied the admin-only rules mutation guard', () => {
  let statusCode = 0;
  let error;
  let nextCalled = false;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      error = body.error;
      return this;
    },
  };

  requireRole('admin')({ user: { role: 'team' } }, response, () => { nextCalled = true; });

  assert.equal(statusCode, 403);
  assert.match(error, /permission/i);
  assert.equal(nextCalled, false);
});

test('admin users may pass the admin-only rules mutation guard', () => {
  let nextCalled = false;
  requireRole('admin')({ user: { role: 'admin' } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
