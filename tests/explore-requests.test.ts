import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestGuard } from '../src/lib/explore/requests';
import { resolveSearchMode } from '../src/lib/explore/session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

test('a later search wins even when the older network response finishes last', async () => {
  const guard = createRequestGuard();
  const slow = deferred<string>();
  const fast = deferred<string>();
  let displayed = '';
  async function run(promise: Promise<string>) {
    const isCurrent = guard.begin();
    const result = await promise;
    if (isCurrent()) displayed = result;
  }
  const first = run(slow.promise);
  const second = run(fast.promise);
  fast.resolve('new route'); await second;
  slow.resolve('old route'); await first;
  assert.equal(displayed, 'new route');
});

test('manual location changes invalidate pending startup GPS and address requests', () => {
  const location = createRequestGuard();
  const startupGps = location.capture();
  const deepLink = location.begin();
  const gpsAlongsideDeepLink = location.capture();
  assert.equal(startupGps(), false);
  assert.equal(deepLink(), true);
  assert.equal(gpsAlongsideDeepLink(), true);
  location.invalidate();
  assert.equal(deepLink(), false);
  assert.equal(gpsAlongsideDeepLink(), false);
});

test('clearing a route or unmounting prevents pending work from committing', async () => {
  const guard = createRequestGuard();
  const request = deferred<string>();
  let committed = false;
  const isCurrent = guard.begin();
  const work = request.promise.then(() => { if (isCurrent()) committed = true; });
  guard.invalidate();
  request.resolve('stale'); await work;
  assert.equal(committed, false);
  assert.equal(guard.begin()(), true);
});

test('editing one pin does not invalidate the other pin request', () => {
  const from = createRequestGuard(); const to = createRequestGuard();
  const oldFrom = from.begin(); const currentTo = to.begin();
  const newFrom = from.begin();
  assert.equal(oldFrom(), false);
  assert.equal(newFrom(), true);
  assert.equal(currentTo(), true);
});

test('mode resolution prioritizes deep links and applies feature constraints', () => {
  assert.equal(resolveSearchMode('near_me', 'along_route'), 'near_me');
  assert.equal(resolveSearchMode('along_route', 'near_me'), 'along_route');
  assert.equal(resolveSearchMode(null, 'along_route'), 'along_route');
  assert.equal(resolveSearchMode('invalid', 'invalid'), 'near_me');
  assert.equal(resolveSearchMode('along_route', 'along_route', false), 'near_me');
});

test('invalid saved coordinates and radii are ignored instead of poisoning initialization', async () => {
  const { readNearMeSession } = await import('../src/lib/explore/session');
  const valid = { center: { lat: 28, lng: 77 }, radius: 'all_india', viewMode: 'list', centerType: 'manual' };
  const store = (value: unknown) => ({ getItem: () => JSON.stringify(value) });
  assert.deepEqual(readNearMeSession(store(valid)), valid);
  assert.equal(readNearMeSession(store({ ...valid, center: { lat: 999, lng: 77 } })), null);
  assert.equal(readNearMeSession(store({ ...valid, radius: null })), null);
  assert.equal(readNearMeSession(store({})), null);
});

test('restorable route sessions retain cleared endpoints and a false GPS flag', async () => {
  const { readAlongRouteSession } = await import('../src/lib/explore/session');
  const saved = { routeFrom: null, routeTo: null, routeFromAddress: '', routeToAddress: '', fromIsGps: false };
  assert.deepEqual(readAlongRouteSession({ getItem: () => JSON.stringify(saved) }), saved);
  assert.equal(readAlongRouteSession({ getItem: () => JSON.stringify({ ...saved, routeTo: {} }) }), null);
});
