import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Editorial OKLCH palette, resolved to strings for Recharts.
const INK = 'oklch(0.36 0.14 263)';
const SAGE = 'oklch(0.5 0.12 155)';
const OCHRE = 'oklch(0.7 0.13 70)';
const BRICK = 'oklch(0.55 0.17 27)';
const STONE = 'oklch(0.65 0.02 260)';
const RULE = 'oklch(0.88 0.012 258)';
const CAPTION = 'oklch(0.5 0.018 258)';

const tooltipStyle: React.CSSProperties = {
  background: 'oklch(1 0 0)',
  border: `1px solid ${RULE}`,
  borderRadius: 6,
  fontSize: 12,
  color: 'oklch(0.22 0.025 260)',
  boxShadow: '0 1px 2px rgba(20, 22, 40, 0.04)',
};

export interface TrendPoint {
  date: string;
  count: number;
}

export function TicketsLineChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((p) => ({
    date: new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    created: p.count,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INK} stopOpacity={0.18} />
            <stop offset="100%" stopColor={INK} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke={RULE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: CAPTION, fontSize: 11 }}
          stroke={RULE}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
        />
        <YAxis
          tick={{ fill: CAPTION, fontSize: 11 }}
          stroke={RULE}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: CAPTION, strokeWidth: 1, strokeDasharray: '2 4' }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: CAPTION }}
          formatter={(v: number) => [v, 'Создано']}
        />
        <Area
          type="monotone"
          dataKey="created"
          stroke={INK}
          strokeWidth={2}
          fill="url(#gradCreated)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  HARDWARE: OCHRE,
  SOFTWARE: INK,
  NETWORK: SAGE,
  OTHER: STONE,
};
const CATEGORY_LABELS: Record<string, string> = {
  HARDWARE: 'Оборудование',
  SOFTWARE: 'Программы',
  NETWORK: 'Сеть',
  OTHER: 'Другое',
};

export function CategoryDonut({ data }: { data: { category: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const items = data.map((d) => ({
    name: CATEGORY_LABELS[d.category] ?? d.category,
    value: Math.round((d.count / total) * 100),
    raw: d.count,
    fill: CATEGORY_COLORS[d.category] ?? BRICK,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={items}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={82}
          paddingAngle={2}
          stroke="oklch(1 0 0)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {items.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, _n: string, p: { payload?: { raw?: number } }) => [
            `${v}% (${p.payload?.raw ?? 0})`,
            'Доля',
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
