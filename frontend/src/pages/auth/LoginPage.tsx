import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/axios';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'USER' | 'AGENT' | 'ADMIN';
    avatarUrl: string | null;
  };
}

const DEMO: { label: string; email: string; password: string }[] = [
  { label: 'Админ', email: 'admin@aitudesk.kz', password: 'Admin123!' },
  { label: 'Агент', email: 'agent1@aitudesk.kz', password: 'Agent123!' },
  { label: 'Пользователь', email: 'user1@aitudesk.kz', password: 'User123!' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPass, setShowPass] = React.useState(false);
  const [email, setEmail] = React.useState('admin@aitudesk.kz');
  const [password, setPassword] = React.useState('Admin123!');
  const [loading, setLoading] = React.useState<string | null>(null);

  async function login(e: string, p: string, id: string) {
    setLoading(id);
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email: e, password: p });
      setAuth(res.data.user, res.data.accessToken);
      toast.success('Вход выполнен');
      navigate('/dashboard');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) toast.error('Неверный email или пароль');
      else if (status === 400) toast.error('Проверьте формат email и пароля');
      else if (status === 429) toast.error('Слишком много попыток. Подождите минуту.');
      else toast.error('Не удалось войти. Сервер не отвечает.');
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(email, password, 'form');
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden lg:flex relative w-[48%] flex-col justify-between overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 rule-grid opacity-60 pointer-events-none" aria-hidden />

        <div className="relative z-10 px-14 pt-12">
          <div className="flex items-baseline justify-between">
            <Brand size="md" className="text-background" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-background/50 tabular-nums">
              Iss. 01 · 2026
            </span>
          </div>
          <div className="mt-5 h-px bg-background/70" />
          <div className="mt-3 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-background/60">
            <span>Astana IT University</span>
            <span>Internal Service Desk</span>
          </div>
        </div>

        <div className="relative z-10 px-14">
          <div className="max-w-[28ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-background/55">
              — Передовая статья
            </p>
            <h1 className="mt-6 font-serif text-[54px] leading-[1.02] tracking-[-0.02em] text-balance">
              Порядок в заявках — <em className="text-background/70">спокойствие</em> в работе.
            </h1>
            <p className="mt-6 max-w-[38ch] text-[14px] leading-relaxed text-background/65 text-pretty">
              AituDesk собирает все обращения в IT-отдел колледжа в одном месте: заявки, переписка,
              база знаний и контроль SLA — без лишних инструментов и без хаоса в почте.
            </p>
          </div>
        </div>

        <div className="relative z-10 px-14 pb-12">
          <div className="h-px bg-background/70" />
          <dl className="mt-5 grid grid-cols-3 gap-6">
            <LedgerStat value="1 240" unit="заявок / мес." />
            <LedgerStat value="2:18" unit="ср. решение, ч" />
            <LedgerStat value="98,4" unit="% SLA" />
          </dl>
          <div className="mt-8 text-[10px] uppercase tracking-[0.22em] text-background/45">
            © 2026 AITU Engineering · Внутренняя система колледжа
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Brand size="md" />
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Вход в систему
            </div>
            <h2 className="mt-3 font-serif text-[36px] leading-[1.05] tracking-[-0.015em]">
              Добро пожаловать.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground text-pretty">
              Используйте корпоративный email AITU — доступ синхронизируется с вашей учётной записью.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-9 space-y-5">
              <Field label="Корпоративный email" htmlFor="email">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aitu.edu.kz"
                  className="h-11 w-full rounded border border-border bg-card pl-10 pr-3 text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/50"
                />
              </Field>

              <Field label="Пароль" htmlFor="password" hint="Забыли пароль?" hintHref="#">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  className="h-11 w-full rounded border border-border bg-card pl-10 pr-10 text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
                  aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                  defaultChecked
                />
                Запомнить меня на этом устройстве
              </label>

              <Button
                type="submit"
                disabled={loading !== null}
                className="w-full h-11 rounded bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {loading === 'form' ? 'Входим...' : 'Войти'}
              </Button>
            </form>

            <div className="mt-10 flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                — или —
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Демо-доступ
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <DemoBtn
                  key={d.email}
                  label={d.label}
                  onClick={() => void login(d.email, d.password, d.email)}
                  loading={loading === d.email}
                />
              ))}
            </div>
          </div>

          <p className="mt-10 text-[13px] text-muted-foreground">
            Нет учётной записи?{' '}
            <Link
              to="/register"
              className="text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
            >
              Зарегистрироваться
            </Link>
          </p>

          <p className="mt-12 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 lg:hidden">
            © 2026 · AITU Engineering
          </p>
        </div>
      </section>
    </div>
  );
}

function LedgerStat({ value, unit }: { value: string; unit: string }) {
  return (
    <div>
      <div className="font-serif text-[28px] leading-none tabular-nums text-background">{value}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-background/55">{unit}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  hintHref,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={htmlFor}
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          {label}
        </label>
        {hint ? (
          <a
            href={hintHref}
            className="text-[11px] text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
          >
            {hint}
          </a>
        ) : null}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function DemoBtn({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="h-10 rounded border border-border bg-card text-[12px] font-medium text-foreground hover:border-foreground/40 hover:bg-accent transition-colors disabled:opacity-60"
    >
      {loading ? '...' : label}
    </button>
  );
}
