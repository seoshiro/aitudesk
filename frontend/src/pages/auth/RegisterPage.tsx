import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/axios';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

interface RegisterResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'USER' | 'AGENT' | 'ADMIN';
    avatarUrl: string | null;
  };
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t('auth.register.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<RegisterResponse>('/auth/register', { name, email, password });
      setAuth(res.data.user, res.data.accessToken);
      toast.success(t('auth.register.success'));
      navigate('/dashboard');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) toast.error(t('auth.register.errors.emailExists'));
      else if (status === 400) toast.error(t('auth.register.errors.badRequest'));
      else toast.error(t('auth.register.errors.server'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden lg:flex relative w-[48%] flex-col justify-between overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 rule-grid opacity-60 pointer-events-none" aria-hidden />

        <div className="relative z-10 px-14 pt-12">
          <div className="flex items-baseline justify-between">
            <Brand size="md" className="text-background" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-background/50 tabular-nums">
              {t('auth.register.masthead')}
            </span>
          </div>
          <div className="mt-5 h-px bg-background/70" />
          <div className="mt-3 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-background/60">
            <span>Astana IT University</span>
            <span>New account</span>
          </div>
        </div>

        <div className="relative z-10 px-14">
          <div className="max-w-[28ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-background/55">
              {t('auth.register.heroEyebrow')}
            </p>
            <h1 className="mt-6 font-serif text-[54px] leading-[1.02] tracking-[-0.02em] text-balance">
              {t('auth.register.heroTitleBefore')}<em className="text-background/70">{t('auth.register.heroTitleEm')}</em>{t('auth.register.heroTitleAfter')}
            </h1>
            <p className="mt-6 max-w-[38ch] text-[14px] leading-relaxed text-background/65 text-pretty">
              {t('auth.register.heroText')}
            </p>
          </div>
        </div>

        <div className="relative z-10 px-14 pb-12">
          <div className="h-px bg-background/70" />
          <ol className="mt-5 space-y-3 text-[13px] leading-snug text-background/70">
            {(t('auth.register.benefits', { returnObjects: true }) as string[]).map((row, i) => (
              <li key={row} className="flex gap-3">
                <span className="font-mono text-[10px] tabular-nums text-background/45 pt-0.5">
                  0{i + 1}
                </span>
                <span>{row}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-[10px] uppercase tracking-[0.22em] text-background/45">
            © 2026 AITU Engineering
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Brand size="md" />
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {t('auth.register.eyebrow')}
            </div>
            <h2 className="mt-3 font-serif text-[36px] leading-[1.05] tracking-[-0.015em]">
              {t('auth.register.title')}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground text-pretty">
              {t('auth.register.description')}
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-9 space-y-5">
              <LabeledInput
                id="name"
                label={t('common.fullName')}
                icon={User}
                value={name}
                onChange={setName}
                required
              />
              <LabeledInput
                id="email"
                label={t('auth.login.corporateEmail')}
                type="email"
                icon={Mail}
                value={email}
                onChange={setEmail}
                required
              />

              <div>
                <FieldLabel htmlFor="password">{t('common.password')}</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.register.passwordPlaceholder')}
                    className="h-11 w-full rounded border border-border bg-card pl-10 pr-10 text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="toggle password"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11.5px] text-muted-foreground">
                  {(t('auth.register.passwordRules', { returnObjects: true }) as string[]).map(
                    (r) => (
                      <li key={r} className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-success" />
                        {r}
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <label className="flex items-start gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                />
                <span>
                  {t('auth.register.agreeBefore')}{' '}
                  <a
                    href="#"
                    className="text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
                  >
                    {t('auth.register.itPolicy')}
                  </a>{' '}
                  {t('auth.register.agreeMiddle')}{' '}
                  <a
                    href="#"
                    className="text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
                  >
                    {t('auth.register.dataPolicy')}
                  </a>
                  .
                </span>
              </label>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {loading ? t('auth.register.submitting') : t('auth.register.submit')}
              </Button>
            </form>
          </div>

          <p className="mt-10 text-[13px] text-muted-foreground">
            {t('auth.register.hasAccount')}{' '}
            <Link
              to="/login"
              className="text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
            >
              {t('auth.register.login')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

function LabeledInput({
  id,
  label,
  type = 'text',
  icon: Icon,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  icon?: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        {Icon ? (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`h-11 w-full rounded border border-border bg-card pr-3 text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/50 ${
            Icon ? 'pl-10' : 'pl-3'
          }`}
        />
      </div>
    </div>
  );
}
