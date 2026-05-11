import { cn } from '@/lib/utils';

export function Brand({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'text-[15px]',
    md: 'text-[19px]',
    lg: 'text-[28px]',
    xl: 'text-[44px] md:text-[56px]',
  };
  const gap = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2', xl: 'gap-2.5' };

  return (
    <span
      className={cn(
        'inline-flex items-baseline tracking-tight text-foreground',
        gap[size],
        sizes[size],
        className,
      )}
    >
      <span className="font-serif italic font-medium leading-none">Aitu</span>
      <span
        className={cn(
          'font-sans uppercase font-semibold leading-none tracking-[0.14em]',
          size === 'xl' ? 'text-[0.52em]' : 'text-[0.62em]',
          '-translate-y-[0.06em] text-muted-foreground',
        )}
      >
        Desk
      </span>
    </span>
  );
}
