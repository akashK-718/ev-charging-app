import Link from 'next/link';
import { Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-ink grid place-items-center">
          <Zap className="w-4 h-4 text-volt" />
        </div>
        <span className="font-display font-bold text-lg">BrandName</span>
      </Link>
    </header>
  );
}
