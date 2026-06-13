import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';
import { safeUrl } from '../utils.js';

function RatioBar({ pris, objectif }) {
  const pct = objectif > 0 ? Math.min(100, Math.round((pris / objectif) * 100)) : 0;
  const cls = pct >= 100 ? 'success' : pct >= 60 ? 'warning' : '';
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <span className="text-sm text-muted">{pris} / {objectif} RDV pris</span>
        <span className="text-sm bold">{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const MONTH_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

export default function Dashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentRdvs, setRecentRdvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getRdvs(),
    ]).then(([s, rdvs]) => {
      setStats(s);
      setRecentRdvs(rdvs.slice(0, 8));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Bonjour, {user?.name?.split(' ')[0]} 👋</div>
          <div className="text-muted text-sm" style={{ marginTop: 4 }}>
            Semaine {stats?.week} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/saisir')}>
          ➕ Saisir un RDV
        </button>
      </div>

      {/* Stats ce mois */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">RDV Pris · {MONTH_FR[(stats?.month ?? new Date().getMonth() + 1) - 1]}</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats?.thisMonth?.pris ?? 0}</div>
          <div className="stat-sub">meetings bookés ce mois</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">RDV Done · {MONTH_FR[(stats?.month ?? new Date().getMonth() + 1) - 1]}</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats?.thisMonth?.done ?? 0}</div>
          <div className="stat-sub">meetings effectués ce mois</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">RDV Pris · S{stats?.week}</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)', fontSize: 28 }}>{stats?.thisWeek?.pris ?? 0}</div>
          <div className="stat-sub">cette semaine</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">RDV Done · S{stats?.week}</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)', fontSize: 28 }}>{stats?.thisWeek?.done ?? 0}</div>
          <div className="stat-sub">cette semaine</div>
        </div>
      </div>

      {/* Objectif mensuel (SDR only) */}
      {user?.role === 'sdr' && stats?.objectif != null && (
        <div className="card mb-24">
          <div className="card-title">🎯 Objectif {MONTH_FR[(stats.month ?? new Date().getMonth() + 1) - 1]} {stats.year}</div>
          <RatioBar pris={stats.thisMonth?.pris ?? 0} objectif={stats.objectif} />
        </div>
      )}

      {/* RDVs récents */}
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span>📋 RDVs récents</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/mes-rdvs')}>Voir tout</button>
        </div>
        {recentRdvs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">Aucun RDV enregistré.<br />Commencez par saisir votre premier RDV.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SDR</th>
                  <th>Marché</th>
                  <th>Prévu le</th>
                  <th>Pris le</th>
                  <th>Statut</th>
                  <th>CRM</th>
                </tr>
              </thead>
              <tbody>
                {recentRdvs.map(rdv => (
                  <tr key={rdv.id}>
                    <td>{rdv.sdr_name}</td>
                    <td>
                      <span className="flex items-center gap-8">
                        <span className="marche-dot" style={{ background: rdv.marche_color }} />
                        {rdv.marche_name}
                      </span>
                    </td>
                    <td>{rdv.date_prevue ? new Date(rdv.date_prevue).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{rdv.date_pris ? new Date(rdv.date_pris).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      {rdv.status === 'done'
                        ? <span className="badge badge-green">✓ Done</span>
                        : rdv.status === 'no_show'
                          ? <span className="badge" style={{ background: 'var(--warning)', color: '#000' }}>No Show</span>
                          : <span className="badge badge-blue">Pris</span>
                      }
                    </td>
                    <td>
                      {safeUrl(rdv.crm_url_pris)
                        ? <a href={safeUrl(rdv.crm_url_pris)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Odoo ↗</a>
                        : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
