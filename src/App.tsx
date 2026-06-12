import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePhevnix } from './context/PhevnixProvider.tsx';
import { AppLayout } from './components/AppLayout.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { TripScreen } from './screens/TripScreen.tsx';
import { LocationScreen } from './screens/LocationScreen.tsx';
import { ChargerScreen } from './screens/ChargerScreen.tsx';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { ActivityScreen } from './screens/ActivityScreen.tsx';
import { InsightsScreen } from './screens/InsightsScreen.tsx';
import { ReceiptScreen } from './screens/ReceiptScreen.tsx';
import { ReservationsScreen } from './screens/ReservationsScreen.tsx';
import { FavoritesScreen } from './screens/FavoritesScreen.tsx';
import { AccountScreen } from './screens/AccountScreen.tsx';

function RequireAuth({ children }: { children: ReactNode }) {
  const { driver } = usePhevnix();
  const location = useLocation();
  if (!driver) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

// An authenticated driver must never sit on /login or /register — otherwise a post-login redirect that
// lands on the auth page re-renders the sign-in screen (and, in a redirect-based BFF flow, re-loops).
// Bounce them home. Render is gated on bootstrap completion, so `driver` is resolved here — no flash.
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { driver } = usePhevnix();
  if (driver) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><AuthScreen mode="login" /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><AuthScreen mode="register" /></RedirectIfAuthed>} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip" element={<TripScreen />} />
        <Route path="/location/:id" element={<LocationScreen />} />
        <Route path="/charger/:id" element={<ChargerScreen />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/activity" element={<ActivityScreen />} />
        <Route path="/insights" element={<InsightsScreen />} />
        <Route path="/activity/:id" element={<ReceiptScreen />} />
        <Route path="/reservations" element={<ReservationsScreen />} />
        <Route path="/favorites" element={<FavoritesScreen />} />
        <Route path="/account" element={<AccountScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
