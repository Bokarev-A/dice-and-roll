import { useEffect, useState } from 'react';
import { usersApi } from '../../api/users';
import type { User, UserRole } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Loader } from '../../components/UI/Loader';
import { formatDate } from '../../utils/format';
import styles from './Admin.module.css';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'player', label: 'Игрок', color: 'blue' },
  { value: 'gm', label: 'Мастер клуба', color: 'purple' },
  { value: 'private_gm', label: 'Мастер частный', color: 'teal' },
];

type PendingChange = { userId: number; role: UserRole };

export function UsersPage() {
  const showToast = useUIStore((s) => s.showToast);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  async function load() {
    try {
      const data = await usersApi.listAll();
      setUsers(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmRoleChange() {
    if (!pendingChange) return;
    try {
      await usersApi.updateRole(pendingChange.userId, pendingChange.role);
      showToast('Роль обновлена!', 'success');
      setPendingChange(null);
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  function requestRoleChange(userId: number, role: UserRole, currentRole: UserRole) {
    if (role === currentRole) return;
    // clicking a different pending for same user replaces it; clicking elsewhere clears
    if (pendingChange?.userId === userId && pendingChange.role === role) {
      setPendingChange(null);
    } else {
      setPendingChange({ userId, role });
    }
  }

  if (loading) return <Loader />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Пользователи</h1>
      <p className={styles.subtitle}>Всего: {users.length}</p>

      <div className={styles.list}>
        {users.map((user) => {
          const isMe = user.id === currentUser?.id;
          const isPending = pendingChange?.userId === user.id;
          const pendingOpt = isPending
            ? ROLE_OPTIONS.find((o) => o.value === pendingChange!.role)
            : null;

          return (
            <div key={user.id} className={`card ${styles.userCard}`}>
              <div className={styles.userHeader}>
                <div className={styles.userAvatar}>
                  {user.first_name.charAt(0)}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>
                    {user.first_name} {user.last_name || ''}
                    {isMe && <span className={styles.youBadge}> (вы)</span>}
                  </span>
                  {user.username && (
                    <span className={styles.userUsername}>@{user.username}</span>
                  )}
                  <span className={styles.userId}>
                    ID: {user.telegram_id} · {formatDate(user.created_at)}
                  </span>
                </div>
              </div>

              <div className={styles.roleRow}>
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`btn btn-sm ${
                      user.role === opt.value ? 'btn-primary' : 'btn-secondary'
                    }`}
                    onClick={() => requestRoleChange(user.id, opt.value, user.role)}
                    disabled={isMe}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isPending && pendingOpt && (
                <div className={styles.roleConfirm}>
                  <span className={styles.roleConfirmText}>
                    Сменить роль на «{pendingOpt.label}»?
                  </span>
                  <div className={styles.roleConfirmActions}>
                    <button className="btn btn-sm btn-primary" onClick={confirmRoleChange}>
                      Да
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setPendingChange(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}