'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MoreVertical, LogOut, Shield, FileText, Info, Smartphone } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { createClient } from '@/lib/supabase/client';
import { clearExploreSession } from '@/lib/user-storage';
import { readPwaDismissal, clearPwaDismissal } from '@/lib/pwa';
import { cn } from '@/lib/utils';

interface ProfileMenuDrawerProps {
  isAdmin: boolean;
}

export function ProfileMenuDrawer({ isAdmin }: ProfileMenuDrawerProps) {
  const [open, setOpen] = useState(false);
  const [isPermanentlyDismissed, setIsPermanentlyDismissed] = useState(false);
  const [installResetDone, setInstallResetDone] = useState(false);

  useEffect(() => {
    setIsPermanentlyDismissed(readPwaDismissal()?.mode === 'never');
  }, []);

  async function handleSignOut() {
    clearExploreSession();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  function handleInstallReset() {
    clearPwaDismissal();
    setInstallResetDone(true);
  }

  const itemClass =
    'flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-ink-soft hover:text-ink hover:bg-surface-page transition-colors w-full text-left';

  const showInstallReset = isPermanentlyDismissed && !installResetDone;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="size-10 grid place-items-center rounded-full bg-white border border-border shadow-sm transition active:scale-95"
        aria-label="Open profile menu"
      >
        <MoreVertical className="size-5 text-ink" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="More">
        <div className="flex flex-col -mx-4 -mt-4 -mb-4">

          {isAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)} className={itemClass}>
              <Shield className="w-4 h-4 text-muted shrink-0" />
              Admin panel
            </Link>
          )}

          <Link href="/profile/about" onClick={() => setOpen(false)} className={itemClass}>
            <Info className="w-4 h-4 text-muted shrink-0" />
            About Kirin
          </Link>

          {showInstallReset && (
            <button
              onClick={() => { handleInstallReset(); setOpen(false); }}
              className={itemClass}
            >
              <Smartphone className="w-4 h-4 text-muted shrink-0" />
              Restore install prompt
            </button>
          )}

          <Link href="/terms" onClick={() => setOpen(false)} className={itemClass}>
            <FileText className="w-4 h-4 text-muted shrink-0" />
            Terms and privacy
          </Link>

          <div className="mx-5 my-1 border-t border-border" />

          <button onClick={handleSignOut} className={cn(itemClass, 'text-danger hover:bg-danger-soft hover:text-danger')}>
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>

        </div>
      </Sheet>
    </>
  );
}
