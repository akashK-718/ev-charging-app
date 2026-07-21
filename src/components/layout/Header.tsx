import Link from 'next/link';

export function Header() {
  return (
    <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <img src="/brand/kirin-icon.svg" alt="Kirin" className="h-8 w-auto" />
      </Link>
    </header>
  );
}
