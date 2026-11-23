import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFilter, applySortDir, groupByDate } from '../src/lib/activity/selectors';
import type { HistoryItem } from '../src/types/activity';

function item(id: string, status: string, scheduledStart: string): HistoryItem {
  return { id, status, scheduledStart, kind: 'charging', roleInSession: 'driver', bookingId: id,
    chargerId: 'charger', chargerTitle: 'Charger', chargerPhoto: null, chargerLat: null,
    chargerLng: null, counterpartyName: null, displayAmountPaise: null, hasRated: false,
    scheduledEnd: null, lifecycleReason: null };
}
const ids = (items: HistoryItem[]) => items.map(i => i.id);

test('upcoming includes active sessions and future requests, excluding past requests and terminal sessions', () => {
  const items = [item('active', 'in_progress', '2026-01-01T09:00:00.000Z'),
    item('future', 'confirmed', '2026-01-03T09:00:00.000Z'),
    item('past', 'pending', '2026-01-01T09:00:00.000Z'),
    item('done', 'completed', '2026-01-03T09:00:00.000Z')];
  assert.deepEqual(ids(applyFilter(items, 'upcoming', '2026-01-02T09:00:00.000Z')), ['active', 'future']);
  assert.deepEqual(ids(applyFilter(items, 'completed')), ['done']);
  assert.deepEqual(applyFilter(items, 'cancelled'), []);
  assert.equal(applyFilter(items, 'all'), items);
});

test('sorting supports both directions without mutating server-provided history', () => {
  const items = [item('old', 'completed', '2026-01-01'), item('new', 'completed', '2026-01-02')];
  assert.deepEqual(ids(applySortDir(items, 'newest')), ['new', 'old']);
  assert.deepEqual(ids(applySortDir(items, 'oldest')), ['old', 'new']);
  assert.deepEqual(ids(items), ['old', 'new']);
});

test('date groups use local midnight boundaries and upcoming sessions are chronological', () => {
  const date = (day: number, hour = 0) => new Date(2026, 0, day, hour).toISOString();
  const items = [item('later', 'confirmed', date(5)), item('tomorrow', 'confirmed', date(4)),
    item('today', 'completed', date(3)), item('yesterday', 'completed', date(2)), item('earlier', 'completed', date(1))];
  const now = new Date(2026, 0, 3, 12);
  const groups = groupByDate(items, now);
  assert.deepEqual(groups.map(g => [g.label, ids(g.items)]), [
    ['Upcoming', ['tomorrow', 'later']], ['Today', ['today']], ['Yesterday', ['yesterday']], ['Earlier', ['earlier']],
  ]);
  assert.equal(now.getHours(), 12);
  assert.deepEqual(groupByDate([], now), []);
});
