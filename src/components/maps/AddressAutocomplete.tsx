'use client';

import { useState, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { maps } from '@/lib/maps/provider';
import type { PlaceSuggestion, Coords } from '@/lib/maps/types';
import { cn } from '@/lib/utils';

export type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: { coords: Coords; address: string }) => void;
  placeholder?: string;
  /** ISO 3166-1 alpha-2 country code. Defaults to 'IN'. */
  country?: string;
  autoFocus?: boolean;
};

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for an address…',
  country = 'IN',
  autoFocus = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.trim().length < 3) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      setIsLoading(true);
      try {
        const results = await maps.autocomplete(query, { country });
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    },
    [country],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchSuggestions(v); }, 300);
  }

  async function handleSelect(s: PlaceSuggestion) {
    setSuggestions([]);
    setShowDropdown(false);

    // Mapbox always returns coords in the suggestion; geocode() is the fallback.
    let coords = s.coords;
    let address = [s.primaryText, s.secondaryText].filter(Boolean).join(', ');

    if (!coords) {
      const result = await maps.geocode(s.id);
      coords = result.coords;
      address = result.formattedAddress;
    }

    onChange(address);
    onSelect({ coords, address });
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-3.5 bg-gray-100 rounded-2xl text-ink',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt',
          )}
        />
        {isLoading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-volt border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 z-30 overflow-hidden">
          {suggestions.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => { void handleSelect(s); }}
                className="w-full px-4 py-3.5 text-left flex items-start gap-3 hover:bg-volt-soft transition-colors"
              >
                <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                <span className="text-sm text-ink leading-snug">
                  <span className="font-semibold">{s.primaryText}</span>
                  {s.secondaryText && (
                    <span className="text-muted">, {s.secondaryText}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
