import { cn } from '@/lib/utils';
import {
  statusLabels,
  priorityLabels,
  type BackendStatus,
  type BackendPriority,
} from '@/lib/mappers';

const statusDot: Record<BackendStatus, string> = {
  NEW: 'bg-info',
  IN_PROGRESS: 'bg-warning',
  WAITING: 'bg-muted-foreground/50',
  RESOLVED: 'bg-success',
  CLOSED: 'bg-muted-foreground/40',
  REOPENED: 'bg-warning',
};

const statusText: Record<BackendStatus, string> = {
  NEW: 'text-info',
  IN_PROGRESS: 'text-warning',
  WAITING: 'text-muted-foreground',
  RESOLVED: 'text-success',
  CLOSED: 'text-muted-foreground/80',
  REOPENED: 'text-warning',
};

const priorityText: Record<BackendPriority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-info',
  HIGH: 'text-warning',
  CRITICAL: 'text-danger',
};

export function StatusBadge({
  status,
  className,
}: {
  status: BackendStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em]',
        statusText[status],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[status])} />
      {statusLabels[status]}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: BackendPriority;
  className?: string;
}) {
  const isCritical = priority === 'CRITICAL';
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-medium uppercase tracking-[0.12em]',
        priorityText[priority],
        isCritical && 'underline decoration-double underline-offset-4',
        className,
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
}
