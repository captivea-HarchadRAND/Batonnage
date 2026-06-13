import { useState, useEffect } from 'react';
import { api } from '../api.js';

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const RANK_CFG = {
  1: { medal:'🥇', label:'Top Performer',  color:'#f59e0b', bg:'linear-gradient(135deg,#f59e0b18,#fbbf2410)', border:'#f59e0b55' },
  2: { medal:'🥈', label:'2ème du podium', color:'#94a3b8', bg:'linear-gradient(135deg,#94a3b818,#cbd5e110)', border:'#94a3b855' },
  3: { medal:'🥉', label:'3ème du podium', color:'#b45309', bg:'linear-gradient(135deg,#b4590918,#d9770610)', border:'#b4530955' },
};

const REMINDER_CFG = {
  overdue:  { icon:'🔴', label:'En retard',    color:'#ef4444', border:'#ef444455', bg:'linear-gradient(135deg,#ef444410,#fee2e210)' },
  today:    { icon:'🟠', label:"Aujourd'hui",  color:'#f97316', border:'#f9731655', bg:'linear-gradient(135deg,#f9731610,#fed7aa10)' },
  upcoming: { icon:'🔵', label:'À venir',      color:'#3b82f6', border:'#3b82f655', bg:'linear-gradient(135deg,#3b82f610,#dbeafe10)' },
};

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem('dismissed_reminders') || '[]')); }
  catch { return new Set(); }
}

function saveDismissed(set) {
  localStorage.setItem('dismissed_reminders', JSON.stringify([...set]));
}

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(loadDismissed);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getNotifications().catch(() => []),
      api.getReminders().catch(() => []),
    ]).then(([data, rems]) => {
      setNotifs(data);
      setReminders(rems);
    }).finally(() => setLoading(false));
  }, []);

  const unseen = notifs.filter(b => !b.seen);
  const seen   = notifs.filter(b => b.seen);
  const visibleReminders = reminders.filter(r => !dismissedIds.has(r.id));

  const markOne = async (id) => {
    await api.markBadgeSeen(id).catch(() => {});
    setNotifs(prev => prev.map(b => b.id === id ? { ...b, seen: 1 } : b));
  };

  const markAll = async () => {
    await api.markBadgesSeen().catch(() => {});
    setNotifs(prev => prev.map(b => ({ ...b, seen: 1 })));
  };

  const dismissOne = async (id) => {
    await api.dismissNotif(id).catch(() => {});
    setNotifs(prev => prev.filter(b => b.id !== id));
  };

  const dismissAll = async () => {
    await Promise.all(notifs.map(b => api.dismissNotif(b.id).catch(() => {})));
    setNotifs([]);
    const next = new Set([...dismissedIds, ...visibleReminders.map(r => r.id)]);
    setDismissedIds(next);
    saveDismissed(next);
  };

  const dismissReminder = (id) => {
    const next = new Set([...dismissedIds, id]);
    setDismissedIds(next);
    saveDismissed(next);
  };

  const dismissAllReminders = () => {
    const next = new Set([...dismissedIds, ...visibleReminders.map(r => r.id)]);
    setDismissedIds(next);
    saveDismissed(next);
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  const overdue  = visibleReminders.filter(r => r.type === 'overdue');
  const today    = visibleReminders.filter(r => r.type === 'today');
  const upcoming = visibleReminders.filter(r => r.type === 'upcoming');

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">🔔 Notifications</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unseen.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={markAll}>
              ✓ Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      {visibleReminders.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
              Rappels RDV ({visibleReminders.length})
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color:'var(--text-muted)' }} onClick={dismissAllReminders}>
              Tout effacer
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {overdue.map(r => <ReminderCard key={r.id} reminder={r} onDismiss={dismissReminder} />)}
            {today.map(r => <ReminderCard key={r.id} reminder={r} onDismiss={dismissReminder} />)}
            {upcoming.map(r => <ReminderCard key={r.id} reminder={r} onDismiss={dismissReminder} />)}
          </div>
        </div>
      )}

      {notifs.length === 0 && visibleReminders.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding: 48, color:'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
          <div style={{ fontSize: 15 }}>Aucune notification pour le moment.</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Tes badges sont toujours visibles dans ton Profil.</div>
        </div>
      )}

      {unseen.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom: 12 }}>
            Non lues ({unseen.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {unseen.map(b => (
              <NotifCard key={b.id} badge={b}
                onRead={() => markOne(b.id)}
                onDismiss={() => dismissOne(b.id)}
              />
            ))}
          </div>
        </div>
      )}

      {seen.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom: 12 }}>
            Déjà lues ({seen.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {seen.map(b => (
              <NotifCard key={b.id} badge={b} read
                onDismiss={() => dismissOne(b.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifCard({ badge, onRead, onDismiss, read }) {
  const cfg = RANK_CFG[badge.rank] || RANK_CFG[3];
  const month = MONTH_FR[badge.month - 1];

  return (
    <div style={{
      background: read ? 'var(--surface)' : cfg.bg,
      border: `1.5px solid ${read ? 'var(--border)' : cfg.border}`,
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
      opacity: read ? 0.6 : 1,
      transition: 'opacity .2s',
    }}>
      <div style={{ fontSize: 36, lineHeight: 1 }}>{cfg.medal}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: read ? 'var(--text)' : cfg.color }}>
          {cfg.label} — {month} {badge.year}
        </div>
        <div style={{ fontSize: 13, color:'var(--text-muted)', marginTop: 2 }}>
          🎯 {badge.rdv_done} RDV done · {new Date(badge.awarded_at).toLocaleDateString('fr-FR')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!read && (
          <button className="btn btn-ghost btn-sm" onClick={onRead} style={{ whiteSpace: 'nowrap' }}>
            ✓ Marquer lu
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
          style={{ whiteSpace: 'nowrap', color: '#ef4444' }}
          title="Supprimer la notification (le badge reste dans ton profil)"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function ReminderCard({ reminder, onDismiss }) {
  const cfg = REMINDER_CFG[reminder.type];
  const date = new Date(reminder.date_prevue + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const today = new Date().toISOString().split('T')[0];
  const daysAgo = reminder.type === 'overdue'
    ? Math.round((new Date(today) - new Date(reminder.date_prevue)) / 86400000)
    : null;
  const daysUntil = reminder.type === 'upcoming'
    ? Math.round((new Date(reminder.date_prevue) - new Date(today)) / 86400000)
    : null;

  return (
    <div style={{
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{cfg.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>{cfg.label}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding:'2px 7px', borderRadius: 99,
            background: cfg.border, color: cfg.color,
          }}>
            {daysAgo != null ? `${daysAgo}j de retard` : daysUntil != null ? `dans ${daysUntil}j` : "Aujourd'hui"}
          </span>
        </div>
        <div style={{ fontSize: 13, color:'var(--text)', fontWeight: 500 }}>
          <span className="marche-dot" style={{ background: reminder.marche_color, display:'inline-block', verticalAlign:'middle', marginRight: 5 }} />
          {reminder.marche_name}
          {reminder.sdr_name && <span style={{ color:'var(--text-muted)', marginLeft: 8 }}>· {reminder.sdr_name}</span>}
        </div>
        <div style={{ fontSize: 12, color:'var(--text-muted)', marginTop: 3 }}>Prévu le {date}</div>
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onDismiss(reminder.id)}
        title="Masquer ce rappel (le RDV n'est pas supprimé)"
        style={{ color:'var(--text-muted)', fontSize: 16, lineHeight: 1, padding:'4px 8px' }}
      >
        ✕
      </button>
    </div>
  );
}
