import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePhevnix } from './context/PhevnixProvider.tsx';
import { AppLayout } from './components/AppLayout.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LocationScreen } from './screens/LocationScreen.tsx';
import { ChargerScreen } from './screens/ChargerScreen.tsx';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { ActivityScreen } from './screens/ActivityScreen.tsx';
import { ReceiptScreen } from './screens/ReceiptScreen.tsx';
import { ReservationsScreen } from './screens/ReservationsScreen.tsx';
import { FavoritesScreen } from './screens/FavoritesScreen.tsx';
import { VehiclesScreen } from './screens/VehiclesScreen.tsx';
import { AccountScreen } from './screens/AccountScreen.tsx';

function RequireAuth({ children }: { children: ReactNode }) {
  const { driver } = usePhevnix();
  const location = useLocation();
  if (!driver) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthScreen mode="login" />} />
      <Route path="/register" element={<AuthScreen mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeScreen />} />
        <Route path="/location/:id" element={<LocationScreen />} />
        <Route path="/charger/:id" element={<ChargerScreen />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/activity" element={<ActivityScreen />} />
        <Route path="/activity/:id" element={<ReceiptScreen />} />
        <Route path="/reservations" element={<ReservationsScreen />} />
        <Route path="/favorites" element={<FavoritesScreen />} />
        <Route path="/vehicles" element={<VehiclesScreen />} />
        <Route path="/account" element={<AccountScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
