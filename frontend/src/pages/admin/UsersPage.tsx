import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/axios';
import type { TicketCategory, User } from '../../types';
import { PageHeader } from '../../components/page-header';
import { UserAvatar } from '../../components/user-avatar';
import { Button } from '../../components/ui/button';
import { getCategoryLabelKey, getRoleLabelKey, type BackendRole } from '../../lib/mappers';

const ROLES: BackendRole[] = ['USER', 'AGENT', 'ADMIN'];
const SPECS: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [roleMap, setRoleMap] = useState<Record<string, BackendRole>>({});
  const [specMap, setSpecMap] = useState<Record<string, TicketCategory[]>>({});

  useEffect(() => {
    void api
      .get<User[]>('/users')
      .then((r) => {
        setUsers(r.data);
        const rm: Record<string, BackendRole> = {};
        const sm: Record<string, TicketCategory[]> = {};
        r.data.forEach((u) => {
          rm[u.id] = u.role;
          sm[u.id] = u.specializations ?? [];
        });
        setRoleMap(rm);
        setSpecMap(sm);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (userId: string) => {
    try {
      await api.put(`/users/${userId}/role`, {
        role: roleMap[userId],
        specializations: specMap[userId],
      });
      toast.success(t('admin.users.roleUpdated'));
      setEditing(null);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: (roleMap[userId] ?? u.role) as User['role'],
                specializations: specMap[userId] ?? [],
              }
            : u,
        ),
      );
    } catch {
      toast.error(t('admin.users.updateError'));
    }
  };

  const toggleSpec = (userId: string, spec: TicketCategory) => {
    setSpecMap((prev) => ({
      ...prev,
      [userId]: prev[userId]?.includes(spec)
        ? prev[userId]!.filter((s) => s !== spec)
        : [...(prev[userId] ?? []), spec],
    }));
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description', { count: users.length })}
      />

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.6fr_0.9fr_1.4fr_0.7fr] gap-4 px-5 py-3 border-b border-border bg-accent/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div>{t('admin.users.columns.user')}</div>
          <div>{t('admin.users.columns.role')}</div>
          <div>{t('admin.users.columns.specializations')}</div>
          <div className="text-right">{t('admin.users.columns.actions')}</div>
        </div>

        <ul>
          {users.map((u) => {
            const isEditing = editing === u.id;
            const currentRole = roleMap[u.id] ?? u.role;
            return (
              <li
                key={u.id}
                className="border-b border-border last:border-b-0 px-5 py-4 grid grid-cols-1 md:grid-cols-[1.6fr_0.9fr_1.4fr_0.7fr] gap-4 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar user={u} size={32} />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                  </div>
                </div>

                <div className="text-sm">
                  {isEditing ? (
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        setRoleMap((p) => ({ ...p, [u.id]: e.target.value as BackendRole }))
                      }
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(getRoleLabelKey(r))}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground">{t(getRoleLabelKey(u.role))}</span>
                  )}
                </div>

                <div className="text-sm">
                  {isEditing && currentRole === 'AGENT' ? (
                    <div className="flex gap-3 flex-wrap">
                      {SPECS.map((s) => (
                        <label
                          key={s}
                          className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={specMap[u.id]?.includes(s) ?? false}
                            onChange={() => toggleSpec(u.id, s)}
                            className="rounded border-border"
                          />
                          {t(getCategoryLabelKey(s))}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {(u.specializations ?? []).map((s) => t(getCategoryLabelKey(s))).join(', ') || '—'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={() => void handleSave(u.id)}>
                        {t('common.save')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(u.id)}>
                      {t('admin.users.change')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
