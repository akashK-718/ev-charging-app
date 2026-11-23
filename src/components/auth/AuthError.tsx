import { cn } from '@/lib/utils';

export function AuthError({ children, id, className }: {
  children: string | null | undefined;
  id?: string;
  className?: string;
}) {
  if (!children) return null;
  return <p id={id} role="alert" className={cn('text-xs font-medium text-danger', className)}>{children}</p>;
}
