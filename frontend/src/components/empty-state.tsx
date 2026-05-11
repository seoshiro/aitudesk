import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const actionBtn = action ? (
    action.href ? (
      <Button asChild className="mt-6">
        <Link to={action.href}>{action.label}</Link>
      </Button>
    ) : (
      <Button onClick={action.onClick} className="mt-6">
        {action.label}
      </Button>
    )
  ) : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center rounded-md border border-dashed border-border bg-card',
        compact ? 'px-6 py-10' : 'px-8 py-16',
        className,
      )}
    >
      <div className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>Пусто</span>
      </div>
      <h3 className="mt-5 font-serif text-[22px] leading-[1.15] tracking-[-0.01em] text-balance">
        {title}
      </h3>
      {description ? (
        <p className="mt-3 max-w-[48ch] text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {actionBtn}
    </div>
  );
}
