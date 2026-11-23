'use client';

import { EmptyState } from '@/components/activity/EmptyState';
import { DriverFeaturedCard, HostFeaturedCard } from '@/components/activity/FeaturedSessions';
import { KIND_ICON } from '@/components/activity/icons';
import { FilterButton, SessionFilterSheet, SortButton } from '@/components/activity/SessionControls';
import { DriverCompactRow, HostCompactRow } from '@/components/activity/SessionRows';
import { NOTIF_LABEL, notifBody, notifItemKind, timeAgo } from '@/lib/activity/presentation';
import { applyFilter, applySortDir, FILTER_LABELS, groupByDate } from '@/lib/activity/selectors';
import { cn } from '@/lib/utils';
import type { FilterType, HistoryItem, SortDir, TabType, UpdateItem } from '@/types/activity';
import { Bell, CalendarCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  historyItems:       HistoryItem[];
  updates:            UpdateItem[];
  initialUnreadCount: number;
}

export function ActivityView({ historyItems, updates, initialUnreadCount }: Props) {
  const [tab,             setTab]             = useState<TabType>('sessions');
  const [filter,          setFilter]          = useState<FilterType>('all');
  const [sortDir,         setSortDir]         = useState<SortDir>('newest');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [unreadCount,     setUnreadCount]     = useState(initialUnreadCount);
  const [markedRead,      setMarkedRead]      = useState(false);
  const [selectedItem,    setSelectedItem]    = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (tab === 'updates' && !markedRead && unreadCount > 0) {
      setMarkedRead(true);
      fetch('/api/activity/mark-updates-read', { method: 'POST' })
        .then(() => setUnreadCount(0))
        .catch(() => {});
    }
  }, [tab, markedRead, unreadCount]);

  const filtered = applyFilter(historyItems, filter);
  const sorted   = applySortDir(filtered, sortDir);
  const featured = sorted[0] ?? null;
  const rest     = sorted.slice(1);
  const grouped  = groupByDate(rest);

  return (
    <div className="min-h-screen bg-surface-page pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10 desk:min-h-0 desk:h-[calc(100dvh-var(--navbar-h))] desk:overflow-hidden">
      <div className="desk:flex desk:h-full">

      {/* ── Left panel: list ─────────────────────────────────────────────────── */}
      <div className="desk:flex-[2] desk:overflow-y-auto desk:border-r desk:border-border">
      <div className="max-w-2xl mx-auto px-4 pt-[var(--screen-top-inset)] desk:max-w-none desk:mx-0 desk:px-6 desk:pt-6">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink">Activity</h1>
          <p className="text-xs text-muted mt-0.5">Your charging sessions and hosting history in one place</p>
        </div>

        {/* Sessions / Updates tabs — GreenPath pill chip style */}
        <div className="flex gap-2 mb-6">
          {(['sessions', 'updates'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold border transition-colors',
                tab === t
                  ? 'bg-green text-white border-green'
                  : 'bg-surface-card text-ink border-border hover:bg-surface-page',
              )}
            >
              {t === 'sessions' ? 'Sessions' : 'Updates'}
              {t === 'updates' && unreadCount > 0 && (
                <span className={cn(
                  'min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full leading-[18px] text-center',
                  tab === t ? 'bg-white/25 text-white' : 'bg-copper text-white',
                )}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sessions ── */}
        {tab === 'sessions' && (
          <div>
            {/* Filter + Sort bar */}
            <div className="flex items-center gap-2 mb-4">
              <FilterButton filter={filter} onClick={() => setFilterSheetOpen(true)} />
              <SortButton sort={sortDir} onChange={setSortDir} />
            </div>

            {sorted.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-7" />}
                title={filter === 'all' ? 'No activity yet' : 'Nothing here'}
                subtitle={
                  filter === 'all'
                    ? 'Your charging sessions and hosting history will appear here'
                    : `No ${FILTER_LABELS[filter].toLowerCase()} sessions found`
                }
              />
            ) : (
              <div className="space-y-5 pb-6">
                {/* Mobile/tablet: featured card (most recent) + grouped compact rows */}
                {featured && (
                  <div className="desk:hidden">
                    {featured.roleInSession === 'driver'
                      ? <DriverFeaturedCard item={featured} />
                      : <HostFeaturedCard item={featured} />
                    }
                  </div>
                )}

                {/* Desktop: all items as a single scrollable compact list (no date grouping) */}
                <div className="hidden desk:block bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
                  <div className="divide-y divide-border">
                    {sorted.map(item => (
                      item.roleInSession === 'driver'
                        ? <DriverCompactRow key={item.id} item={item} onSelect={setSelectedItem} isSelected={selectedItem?.id === item.id} />
                        : <HostCompactRow   key={item.id} item={item} onSelect={setSelectedItem} isSelected={selectedItem?.id === item.id} />
                    ))}
                  </div>
                </div>

                {/* Mobile/tablet: grouped compact rows (excludes the featured item) */}
                {grouped.length > 0 && (
                  <div className="desk:hidden bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
                    {grouped.map(({ label, items }, gi) => (
                      <div key={label}>
                        <div className={cn(
                          'px-4 py-2 bg-surface-page',
                          gi > 0 && 'border-t border-border',
                        )}>
                          <p className="text-[10px] font-semibold text-muted tracking-wider uppercase">
                            {label}
                          </p>
                        </div>
                        <div className="divide-y divide-border">
                          {items.map(item => (
                            item.roleInSession === 'driver'
                              ? <DriverCompactRow key={item.id} item={item} />
                              : <HostCompactRow key={item.id} item={item} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <SessionFilterSheet
              isOpen={filterSheetOpen}
              items={historyItems}
              filter={filter}
              onSelect={setFilter}
              onClose={() => setFilterSheetOpen(false)}
            />
          </div>
        )}

        {/* ── Updates ── */}
        {tab === 'updates' && (
          <div>
            {updates.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-7" />}
                title="No updates yet"
                subtitle="Booking confirmations, session events, and account updates will appear here"
              />
            ) : (
              <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border mb-6">
                {updates.map(u => {
                  const kind = notifItemKind(u.type);
                  const cfg  = KIND_ICON[kind];
                  const body = notifBody(u.type, u.data);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                      {/* Kind-coded icon tile with unread dot */}
                      <div className={cn('relative size-10 rounded-2xl grid place-items-center shrink-0', cfg.bg)}>
                        {cfg.icon}
                        {!u.read && (
                          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm text-ink truncate', u.read ? 'font-medium' : 'font-semibold')}>
                          {NOTIF_LABEL[u.type] ?? u.type.replace(/_/g, ' ')}
                        </p>
                        {body && (
                          <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{body}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted whitespace-nowrap">
                        {timeAgo(u.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>{/* end inner max-w wrapper */}
      </div>{/* end left panel */}

      {/* ── Right panel: session detail (desktop only) ───────────────────────── */}
      <aside className="hidden desk:flex desk:flex-[3] desk:overflow-y-auto desk:p-8 desk:items-start desk:justify-center">
        {selectedItem ? (
          <div className="w-full max-w-md">
            {selectedItem.roleInSession === 'driver'
              ? <DriverFeaturedCard item={selectedItem} />
              : <HostFeaturedCard item={selectedItem} />
            }
          </div>
        ) : (
          <EmptyState
            icon={<CalendarCheck className="size-7" />}
            title="Select a session"
            subtitle="Click any session in the list to see its details here"
          />
        )}
      </aside>

      </div>{/* end desk:flex row */}
    </div>
  );
}
