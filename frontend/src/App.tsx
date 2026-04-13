import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useTelegram } from './hooks/useTelegram';
import { Layout } from './components/Layout/Layout';
import { Loader } from './components/UI/Loader';

// Pages
import { HomePage } from './pages/Home/HomePage';
import { CatalogPage } from './pages/Catalog/CatalogPage';
import { MySessionsPage } from './pages/MySessions/MySessionsPage';
import { ShopPage } from './pages/Shop/ShopPage';
import { PaymentPage } from './pages/Shop/PaymentPage';
import { CampaignPage } from './pages/Campaign/CampaignPage';
import { SessionDetailPage } from './pages/Session/SessionDetailPage';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { SchedulePage } from './pages/Schedule/SchedulePage';

// GM pages
import { GMSessionDetailPage } from './pages/GM/GMSessionDetailPage';
import { AttendancePage } from './pages/GM/AttendancePage';

// Admin pages
import { OrdersPage } from './pages/Admin/OrdersPage';
import { UsersPage } from './pages/Admin/UsersPage';
import { UnpaidPage } from './pages/Admin/UnpaidPage';

const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true';

function GMCampaignIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/campaign/${id}`} replace />;
}

function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  const isGM = user?.role === 'gm' || user?.role === 'private_gm' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/my-sessions" element={<MySessionsPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/pay/:orderId" element={<PaymentPage />} />
        <Route path="/campaign/:id" element={<CampaignPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/schedule" element={<SchedulePage />} />

        {isGM && (
          <>
            <Route path="/gm/campaigns" element={<Navigate to="/catalog" replace />} />
            <Route path="/gm/campaigns/:id" element={<GMCampaignIdRedirect />} />
            <Route path="/gm/sessions/:id" element={<GMSessionDetailPage />} />
            <Route path="/gm/attendance/:sessionId" element={<AttendancePage />} />
          </>
        )}

        {isAdmin && (
          <>
            <Route path="/admin/orders" element={<OrdersPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/unpaid" element={<UnpaidPage />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a1a',
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'sans-serif',
    }}>
      <span style={{ fontSize: '4rem', marginBottom: '16px' }}>🎲</span>
      <h1 style={{
        fontSize: '1.5rem',
        color: '#ff2d95',
        marginBottom: '12px',
      }}>
        Dice & Roll
      </h1>
      <p style={{
        color: '#8888bb',
        fontSize: '0.9rem',
        maxWidth: '300px',
      }}>
        {message}
      </p>
    </div>
  );
}

export default function App() {
  const { initData } = useTelegram();
  const { init, loading, error, user } = useAuthStore();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const data = initData || import.meta.env.VITE_MOCK_INIT_DATA || '';

    if (data) {
      init(data).finally(() => setAttempted(true));
    } else if (IS_DEV) {
      // Dev mode: set fake user directly
      const devRole = (import.meta.env.VITE_DEV_ROLE || 'admin') as 'player' | 'gm' | 'admin';
      useAuthStore.setState({
        user: {
          id: 1,
          telegram_id: 123456789,
          first_name: 'Dev',
          last_name: devRole === 'gm' ? 'GM' : devRole === 'player' ? 'Player' : 'Admin',
          username: `dev_${devRole}`,
          role: devRole,
          created_at: new Date().toISOString(),
        },
        loading: false,
        error: null,
      });
      setAttempted(true);
    } else {
      setAttempted(true);
    }
  }, []);

  if (!attempted || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a1a',
      }}>
        <Loader />
      </div>
    );
  }

  if (error || !user) {
    return <ErrorScreen message={error || 'Откройте приложение через Telegram'} />;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}