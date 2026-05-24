import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { PageHeader } from '../../components/page-header';
import { UserAvatar } from '../../components/user-avatar';
import { Button } from '../../components/ui/button';
import { getRoleLabelKey, type BackendRole } from '../../lib/mappers';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.put<{
        id: string;
        name: string;
        email: string;
        role: string;
        avatarUrl: string | null;
      }>('/users/me', { name, email });
      updateUser({ name: r.data.name, email: r.data.email });
      toast.success(t('profile.updated'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const r = await api.post<{ avatarUrl: string }>('/users/me/avatar', fd);
      updateUser({ avatarUrl: r.data.avatarUrl });
      toast.success(t('profile.avatarUpdated'));
    } catch {
      toast.error(t('profile.avatarError'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />

      <div className="mt-6 rounded-md border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-5 pb-6 border-b border-border">
          <div className="relative">
            <UserAvatar user={user} size={72} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={t('profile.changeAvatar')}
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleAvatar(e)}
            />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-xl tracking-[-0.01em] truncate">{user.name}</div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t(getRoleLabelKey(user.role as BackendRole))}
            </div>
            <div className="mt-1 text-sm text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>

        <form onSubmit={(e) => void handleUpdate(e)} className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-medium block mb-1.5">{t('common.fullName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
