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
  { value: 'gm', label: 'Мастер', color: 'purple' },
  { value: 'admin', label: 'Админ', color: 'pink' },
];

export function UsersPage() {
  const showToast = useUIStore((s) => s.showToast);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function handleRoleChange(userId: number, role: UserRole) {
    try {
      await usersApi.updateRole(userId, role);
      showToast('Роль обновлена!', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
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
                    onClick={() => handleRoleChange(user.id, opt.value)}
                    disabled={isMe}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}