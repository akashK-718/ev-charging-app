'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CONNECTOR_TYPES } from '@/lib/constants';
import { ChargerCard, type ChargerRow } from './ChargerCard';

const ALL = 'All';

export function ChargerListView({ chargers }: { chargers: ChargerRow[] }) {
  const [filter, setFilter] = useState<string>(ALL);

  const visible =
    filter === ALL
      ? chargers
      : chargers.filter(c => (c.connector_types as string[]).includes(filter));

  return (
    <div>
      {/* Connector filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[ALL, ...CONNECTOR_TYPES].map(ct => (
          <button
            key={ct}
            onClick={() => setFilter(ct)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              filter === ct
                ? 'bg-ink text-white'
                : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
            )}
          >
            {ct}
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center gap-3">
          <p className="font-semibold text-ink">No chargers found</p>
          <p className="text-sm text-muted max-w-xs">
            {filter === ALL
              ? 'No chargers are listed yet. Check back soon!'
              : `No chargers support ${filter} right now. Try a different connector type.`}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(c => (
            <ChargerCard key={c.id} charger={c} />
          ))}
        </div>
      )}
    </div>
  );
}
