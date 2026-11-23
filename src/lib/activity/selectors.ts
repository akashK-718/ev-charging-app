import type { FilterType, HistoryItem, SortDir } from '../../types/activity';

export const FILTER_LABELS: Record<FilterType, string> = {
  all:       'All',
  upcoming:  'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const SORT_LABELS: Record<SortDir, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
};

export function applyFilter(items: HistoryItem[], filter: FilterType, now = new Date().toISOString()): HistoryItem[] {
  if (filter === 'all') return items;
  if (filter === 'upcoming') {
    return items.filter(i =>
      i.status === 'in_progress' ||
      (['confirmed', 'pending', 'awaiting_driver_confirmation'].includes(i.status) &&
        i.scheduledStart > now),
    );
  }
  if (filter === 'completed') return items.filter(i => i.status === 'completed');
  if (filter === 'cancelled') return items.filter(i => i.status === 'cancelled');
  return items;
}

export function applySortDir(items: HistoryItem[], dir: SortDir): HistoryItem[] {
  return [...items].sort((a, b) => {
    const diff = new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime();
    return dir === 'newest' ? diff : -diff;
  });
}

// ── Grouping (applied to compact list only) ───────────────────────────────────

export type DateGroup = { label: string; items: HistoryItem[] };

export function groupByDate(items: HistoryItem[], referenceDate = new Date()): DateGroup[] {
  const todayStart     = new Date(referenceDate); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart  = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const buckets: Record<'upcoming' | 'today' | 'yesterday' | 'earlier', HistoryItem[]> = {
    upcoming: [], today: [], yesterday: [], earlier: [],
  };

  for (const item of items) {
    const d = new Date(item.scheduledStart);
    if      (d >= tomorrowStart)  buckets.upcoming.push(item);
    else if (d >= todayStart)     buckets.today.push(item);
    else if (d >= yesterdayStart) buckets.yesterday.push(item);
    else                          buckets.earlier.push(item);
  }

  buckets.upcoming.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  return (
    [
      { label: 'Upcoming',  items: buckets.upcoming   },
      { label: 'Today',     items: buckets.today      },
      { label: 'Yesterday', items: buckets.yesterday  },
      { label: 'Earlier',   items: buckets.earlier    },
    ] satisfies DateGroup[]
  ).filter(g => g.items.length > 0);
}
