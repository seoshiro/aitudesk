import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'amber' | 'green' | 'red';

const accentStroke: Record<Accent, string> = {
  blue: 'oklch(0.36 0.14 263)',
  amber: 'oklch(0.62 0.14 65)',
  green: 'oklch(0.5 0.12 155)',
  red: 'oklch(0.55 0.17 27)',
};

const accentLabel: Record<Accent, string> = {
  blue: 'text-primary',
  amber: 'text-warning',
  green: 'text-success',
  red: 'text-danger',
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaDirection = 'up',
  data = [],
  accent = 'blue',
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  data?: number[];
  accent?: Accent;
  className?: string;
}) {
  const series = data.map((v, i) => ({ i, v }));
  const Trend = deltaDirection === 'up' ? ArrowUpRight : ArrowDownRight;
  const deltaPositive = deltaDirection === 'up';

  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between rounded-md border border-border bg-card px-5 pt-5 pb-4',
        'transition-colors',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h3
          className={cn(
            'text-[11px] font-medium uppercase tracking-[0.14em]',
            accentLabel[accent],
          )}
        >
          {label}
        </h3>
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
              deltaPositive ? 'text-success' : 'text-danger',
            )}
          >
            <Trend className="h-3 w-3" strokeWidth={2.25} />
            {delta}
          </span>
        ) : null}
      </header>

      <div className="mt-6 flex items-end gap-3">
        <span className="font-serif text-5xl leading-none tracking-[-0.02em] tabular-nums">
          {value}
        </span>
      </div>

      {hint ? (
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}

      {series.length > 0 ? (
        <div className="mt-3 -mx-1 h-8 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, left: 2, right: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentStroke[accent]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={accentStroke[accent]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={accentStroke[accent]}
                strokeWidth={1.25}
                fill={`url(#spark-${accent})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </article>
  );
}
