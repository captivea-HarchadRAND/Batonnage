import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext.jsx';
import { api } from '../api.js';
import BadgeReveal from './BadgeReveal.jsx';

const ICON = {
  dashboard: '📊', saisir: '➕', mesRdvs: '📋',
  synthesis: '📈', leaderboard: '🏆', admin: '⚙️',
  profile: '👤', logout: '🚪',
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getRoleLabel(role) {
  return { admin: 'Admin', manager: 'Manager', sdr: 'SDR' }[role] || role;
}

export default function Layout() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const bellRef  = useRef(null);

  const [unseenBadges, setUnseenBadges] = useState([]);
  const [showReveal,   setShowReveal]   = useState(false);
  const [allBadges,    setAllBadges]    = useState([]);
  const [showBellDrop, setShowBellDrop] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.getNotifications().then(notifs => {
      setAllBadges(notifs);
      const unseen = notifs.filter(b => !b.seen);
      setUnseenBadges(unseen);
      if (unseen.length > 0 && location.pathname !== '/notifications') setShowReveal(true);
    }).catch(() => {});
    api.getReminders().then(rs => {
      try {
        const dismissed = new Set(JSON.parse(localStorage.getItem('dismissed_reminders') || '[]'));
        setReminderCount(rs.filter(r => !dismissed.has(r.id)).length);
      } catch { setReminderCount(rs.length); }
    }).catch(() => {});
  }, [user?.id, location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleRevealDone = () => {
    setShowReveal(false);
    setUnseenBadges([]);
    setShowBellDrop(true);
    setTimeout(() => setShowBellDrop(false), 1500);
  };

  const unseenCount = unseenBadges.length + reminderCount;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">B</div>
          <span className="sidebar-logo-text">Batonnage</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">{ICON.dashboard}</span> Dashboard
          </NavLink>

          <NavLink to="/saisir" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">{ICON.saisir}</span> Saisir RDV
          </NavLink>

          <NavLink to="/mes-rdvs" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">{ICON.mesRdvs}</span> Mes RDVs
          </NavLink>

          <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">{ICON.leaderboard}</span> Classement
          </NavLink>

          {(user?.role === 'manager' || user?.role === 'admin') && (
            <>
              <div className="nav-section-title">Management</div>
              <NavLink to="/appels" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-link-icon">📞</span> Appels
              </NavLink>
              <NavLink to="/synthesis" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-link-icon">{ICON.synthesis}</span> Synthesis
              </NavLink>
              <NavLink to="/performances" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-link-icon">📊</span> Performances
              </NavLink>
              <NavLink to="/suivi-problemes" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-link-icon">🔍</span> Suivi Problèmes
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-link-icon">{ICON.admin}</span> Admin
              </NavLink>
            </>
          )}

          <div className="nav-section-title">Mon compte</div>
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">{ICON.profile}</span>
            Profil
          </NavLink>

          <NavLink to="/notifications" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-link-icon">
              <span ref={bellRef} style={{
                position: 'relative', display: 'inline-flex',
                animation: showBellDrop || unseenCount > 0 ? 'bellRing .5s ease 2' : 'none',
              }}>
                <span style={{ filter: unseenCount > 0 ? 'none' : 'grayscale(1) opacity(.45)' }}>🔔</span>
                {unseenCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -7,
                    background: '#ef4444', color: '#fff',
                    borderRadius: '50%', width: 16, height: 16,
                    fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 6px rgba(239,68,68,.7)',
                    animation: 'popIn .3s cubic-bezier(.34,1.56,.64,1)',
                  }}>{unseenCount}</span>
                )}
              </span>
            </span>
            Notifications
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{getInitials(user?.name)}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{getRoleLabel(user?.role)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Déconnexion">
              {ICON.logout}
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {/* Popup reveal badge */}
      {showReveal && unseenBadges.length > 0 && (
        <BadgeReveal
          badges={unseenBadges}
          bellRef={bellRef}
          onDone={handleRevealDone}
        />
      )}

      <style>{`
        @keyframes bellRing {
          0%,100%{transform:rotate(0)}
          25%{transform:rotate(-20deg)}
          75%{transform:rotate(20deg)}
        }
        @keyframes popIn {
          from{transform:scale(0)} to{transform:scale(1)}
        }
      `}</style>
    </div>
  );
}
