import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './NavBar.module.css';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const playerNav: NavItem[] = [
    { path: '/', icon: '🏠', label: 'Главная' },
    { path: '/catalog', icon: '🎲', label: 'Каталог' },
    { path: '/my-sessions', icon: '📅', label: 'Сессии' },
    { path: '/shop', icon: '💎', label: 'Магазин' },
    { path: '/profile', icon: '👤', label: 'Профиль' },
  ];

  const gmNav: NavItem[] = [
    { path: '/', icon: '🏠', label: 'Главная' },
    { path: '/gm/campaigns', icon: '🎲', label: 'Кампании' },
    { path: '/my-sessions', icon: '📅', label: 'Сессии' },
    { path: '/shop', icon: '💎', label: 'Магазин' },
    { path: '/profile', icon: '👤', label: 'Профиль' },
  ];

  const adminNav: NavItem[] = [
    { path: '/', icon: '🏠', label: 'Главная' },
    { path: '/admin/orders', icon: '💳', label: 'Оплаты' },
    { path: '/gm/campaigns', icon: '🎲', label: 'Кампании' },
    { path: '/admin/users', icon: '👥', label: 'Юзеры' },
    { path: '/profile', icon: '👤', label: 'Профиль' },
  ];

  let navItems = playerNav;
  if (user?.role === 'gm') navItems = gmNav;
  if (user?.role === 'admin') navItems = adminNav;

  return (
    <nav className={styles.navbar}>
      {navItems.map((item) => {
        const isActive =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}