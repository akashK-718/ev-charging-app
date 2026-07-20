'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

function validateName(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(trimmed)) return 'Name can only contain letters and spaces.';
  return null;
}

export function NameEditor({
  initialName,
  showKycContext,
  onNameChange,
}: {
  initialName: string | null;
  showKycContext: boolean;
  onNameChange?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName ?? '');
  const [displayName, setDisplayName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  function startEdit() {
    setValue(displayName ?? '');
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const err = validateName(value);
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.');
        return;
      }
      setDisplayName(data.data.name);
      onNameChange?.(data.data.name);
      setEditing(false);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted mb-0.5">Name</p>

      {editing ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancelEdit(); }}
              maxLength={50}
              autoFocus
              className={cn(
                'flex-1 px-3 py-2 rounded-xl border text-sm font-medium text-ink',
                'focus:outline-none focus:ring-2 focus:ring-volt transition-colors',
                error ? 'border-red-400 bg-red-50' : 'border-gray-200',
              )}
            />
            <button
              onClick={save}
              disabled={saving}
              aria-label="Save name"
              className="p-2 rounded-xl bg-volt text-ink hover:bg-volt/80 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={cancelEdit}
              aria-label="Cancel"
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">{displayName ?? '—'}</p>
          <button
            onClick={startEdit}
            aria-label="Edit name"
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted" />
          </button>
        </div>
      )}

      {toast && (
        <p className="text-xs text-green-700 font-medium mt-1">Name updated!</p>
      )}

      {!editing && (
        <p className="text-xs text-muted mt-1 leading-relaxed">
          {showKycContext
            ? 'This is your display name. Your legal name (from verification documents) is separate and used only for payouts and receipts.'
            : 'This is how others see you. You can edit it anytime.'}
        </p>
      )}
    </div>
  );
}
