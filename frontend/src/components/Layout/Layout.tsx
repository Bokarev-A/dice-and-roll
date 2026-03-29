import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { Toast } from '../UI/Toast';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <div className={`${styles.app} scanlines`}>
      <Toast />
      <main className={styles.main}>
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}