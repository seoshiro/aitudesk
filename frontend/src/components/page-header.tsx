import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-5 border-b border-border',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.015em] text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{children}</div>
      ) : null}
    </div>
  );
}
