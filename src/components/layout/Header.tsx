import Link from 'next/link';

export function Header() {
  return (
    <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="EV Charging" className="w-8 h-8 object-contain" />
        <span className="font-display font-bold text-lg">BrandName</span>
      </Link>
    </header>
  );
}
