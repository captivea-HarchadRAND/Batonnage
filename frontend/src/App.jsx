import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SaisirRdv from './pages/SaisirRdv.jsx';
import MesRdvs from './pages/MesRdvs.jsx';
import Synthesis from './pages/Synthesis.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Admin from './pages/Admin.jsx';
import Performance from './pages/Performance.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';
import SuiviProblemes from './pages/SuiviProblemes.jsx';
import Appels from './pages/Appels.jsx';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useUser();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useUser();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/invite/:token" element={<PublicRoute><AcceptInvite /></PublicRoute>} />

      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="saisir" element={<SaisirRdv />} />
        <Route path="mes-rdvs" element={<MesRdvs />} />
        <Route path="appels" element={
          <PrivateRoute roles={['manager', 'admin']}><Appels /></PrivateRoute>
        } />
        <Route path="synthesis" element={
          <PrivateRoute roles={['manager', 'admin']}><Synthesis /></PrivateRoute>
        } />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="performances" element={
          <PrivateRoute roles={['manager', 'admin']}><Performance /></PrivateRoute>
        } />
        <Route path="suivi-problemes" element={
          <PrivateRoute roles={['manager', 'admin']}><SuiviProblemes /></PrivateRoute>
        } />
        <Route path="admin" element={
          <PrivateRoute roles={['manager', 'admin']}><Admin /></PrivateRoute>
        } />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </UserProvider>
  );
}
