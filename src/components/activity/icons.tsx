import type { ActivityKind } from '@/types/activity';
import { CalendarCheck, CreditCard, Home, Info, Star, Wallet } from 'lucide-react';

export const KIND_ICON: Record<ActivityKind, { icon: React.ReactNode; bg: string }> = {
  booking: { icon: <CalendarCheck className="size-4" />, bg: 'bg-blue-50 text-blue-600' },
  session: { icon: <Star className="size-4" />,          bg: 'bg-amber-50 text-amber-600' },
  payment: { icon: <CreditCard className="size-4" />,    bg: 'bg-violet-50 text-violet-600' },
  payout:  { icon: <Wallet className="size-4" />,        bg: 'bg-emerald-50 text-emerald-600' },
  host:    { icon: <Home className="size-4" />,          bg: 'bg-green-50 text-green-700' },
  notice:  { icon: <Info className="size-4" />,          bg: 'bg-zinc-100 text-zinc-500' },
};
