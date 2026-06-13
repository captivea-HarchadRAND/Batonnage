import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';
import { safeUrl } from '../utils.js';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PODIUM_SIZE = { 1: 96, 2: 80, 3: 72 };
const PODIUM_ORDER = [2, 1, 3]; // visually: 2nd left, 1st center, 3rd right

function scaleObjectif(objectif, period, start, end) {
  if (period === 'week')  return Math.round(objectif / 4);
  if (period === 'month') return objectif;
  if (period === 'year')  return objectif * 12;
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return Math.max(1, Math.round(objectif * days / 30));
}

function localDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return localDate(date);
}

function getSunday(d) {
  const monday = new Date(getMonday(d));
  monday.setDate(monday.getDate() + 6);
  return localDate(monday);
}

function fmt(dateStr) {
  return dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '—';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ src, name, size = 40, rank }) {
  const ringColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : 'var(--border)';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: `3px solid ${ringColor}`,
      background: 'var(--surface2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'var(--primary)',
    }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : getInitials(name)
      }
    </div>
  );
}

function Podium({ top3, showAppels, metric = 'rdv' }) {
  const byRank = {};
  top3.forEach(r => { byRank[r.rank] = r; });

  const isAppelMode = metric === 'appels';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, padding: '32px 16px 0', width: '100%', boxSizing: 'border-box' }}>
      {PODIUM_ORDER.map(rank => {
        const r = byRank[rank];
        if (!r) return <div key={rank} style={{ width: 120 }} />;
        const isFirst = rank === 1;
        const blockH = rank === 1 ? 80 : rank === 2 ? 56 : 40;
        const blockColor = rank === 1 ? '#f59e0b22' : rank === 2 ? '#94a3b822' : '#b4590922';
        const blockBorder = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : '#b45309';

        return (
          <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 120 }}>
            <Avatar src={r.avatar} name={r.name} size={PODIUM_SIZE[rank]} rank={rank} />
            <div style={{ fontWeight: 700, fontSize: isFirst ? 15 : 13, textAlign: 'center', lineHeight: 1.3 }}>
              {r.name.split(' ')[0]}
            </div>

            {/* Score principal */}
            {isAppelMode ? (
              <div style={{ fontSize: isFirst ? 15 : 13, fontWeight: 700, color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: isFirst ? 13 : 11 }}>📞</span> {r.total_appels}
              </div>
            ) : (
              <div style={{ fontSize: isFirst ? 20 : 16, fontWeight: 800, color: blockBorder }}>
                {r.rdv_done} done
              </div>
            )}

            {/* Appels en secondaire sur le podium RDV */}
            {!isAppelMode && showAppels && (
              <div style={{
                fontSize: isFirst ? 13 : 11, fontWeight: 600,
                color: r.total_appels > 0 ? '#f97316' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                📞 {r.total_appels > 0 ? r.total_appels : '—'}
              </div>
            )}


            <div style={{ fontSize: isFirst ? 28 : 22 }}>{MEDALS[rank]}</div>
            <div style={{
              width: '100%', height: blockH, borderRadius: '8px 8px 0 0',
              background: blockColor, border: `2px solid ${blockBorder}`,
              borderBottom: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: blockBorder,
            }}>
              {rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SdrModal({ sdr, start, end, onClose }) {
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRdvs({ sdr_id: sdr.id, start, end }).then(setRdvs).finally(() => setLoading(false));
  }, [sdr.id, start, end]);

  const pris = rdvs.filter(r => r.crm_url_pris).length;
  const done = rdvs.filter(r => r.status === 'done').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 860, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Avatar src={sdr.avatar} name={sdr.name} size={32} rank={sdr.rank} />
            <span style={{ marginLeft: 10 }}>{sdr.name}</span>
            <span className="text-muted text-sm" style={{ marginLeft: 12, fontWeight: 400 }}>{start} → {end}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="flex gap-16 mb-16" style={{ padding: '8px 0' }}>
          <span className="text-sm"><strong style={{ color: 'var(--primary)' }}>{pris}</strong> pris</span>
          <span className="text-sm"><strong style={{ color: 'var(--success)' }}>{done}</strong> done</span>
          <span className="text-sm text-muted">{rdvs.length} total</span>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
        ) : rdvs.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">Aucun RDV sur cette période.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Marché</th><th>Sem.</th><th>Pris le</th><th>Prévu le</th>
                  <th>Done le</th><th>Statut</th><th>CRM Pris</th><th>CRM Done</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rdvs.map(r => (
                  <tr key={r.id}>
                    <td><span className="flex items-center gap-8"><span className="marche-dot" style={{ background: r.marche_color }} />{r.marche_name}</span></td>
                    <td className="text-muted text-sm">S{r.semaine}</td>
                    <td>{fmt(r.date_pris)}</td><td>{fmt(r.date_prevue)}</td><td>{fmt(r.date_done)}</td>
                    <td>
                      {r.status === 'done'
                        ? <span className="badge badge-green">✓ Done</span>
                        : r.status === 'no_show'
                          ? <span className="badge" style={{ background: 'var(--warning)', color: '#000' }}>No Show</span>
                          : <span className="badge badge-blue">Pris</span>}
                    </td>
                    <td>{safeUrl(r.crm_url_pris) ? <a href={safeUrl(r.crm_url_pris)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">↗</a> : '—'}</td>
                    <td>{safeUrl(r.crm_url_done) ? <a href={safeUrl(r.crm_url_done)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">↗</a> : '—'}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</td>
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

export default function Leaderboard() {
  const { user } = useUser();
  const now = new Date();
  const thisMonthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisMonthEnd   = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [start, setStart]       = useState(thisMonthStart);
  const [end, setEnd]           = useState(thisMonthEnd);
  const [ranking, setRanking]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedSdr, setSelectedSdr] = useState(null);
  const [period, setPeriod]     = useState('month');
  const [showPeriodFilter, setShowPeriodFilter] = useState(false);
  const [podiumTab, setPodiumTab] = useState('rdv');

  useEffect(() => {
    api.getSettings().then(s => {
      setShowPeriodFilter(s.leaderboard_period_filter === '1');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getLeaderboard({ start, end }).then(setRanking).finally(() => setLoading(false));
  }, [start, end]);

  const setThisWeek  = () => { setStart(getMonday(now)); setEnd(getSunday(now)); setPeriod('week'); };
  const setThisMonth = () => { setStart(thisMonthStart); setEnd(thisMonthEnd); setPeriod('month'); };
  const setThisYear  = () => { setStart(localDate(new Date(now.getFullYear(), 0, 1))); setEnd(localDate(new Date(now.getFullYear(), 11, 31))); setPeriod('year'); };

  const top3   = ranking.filter(r => r.rank <= 3);
  const isSdr  = user?.role === 'sdr';
  const topAppels = !isSdr
    ? [...ranking]
        .filter(r => r.total_appels > 0)
        .sort((a, b) => b.total_appels - a.total_appels)
        .slice(0, 3)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">🏆 Classement SDR</div>
      </div>

      {/* Filtres */}
      <div className="card mb-24">
        <div className="flex items-center gap-12 flex-wrap">
          <div className="form-group" style={{ flex: '0 0 auto' }}>
            <label className="form-label">Du</label>
            <input className="form-input" type="date" value={start} max={end || undefined}
              onChange={e => { const v = e.target.value; setStart(v); if (end && v > end) setEnd(v); setPeriod('custom'); }}
              style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ flex: '0 0 auto' }}>
            <label className="form-label">Au</label>
            <input className="form-input" type="date" value={end} min={start || undefined}
              onChange={e => { const v = e.target.value; setEnd(v); if (start && v < start) setStart(v); setPeriod('custom'); }}
              style={{ width: 160 }} />
          </div>
          <div className="flex gap-8" style={{ marginTop: 20 }}>
            <button className={`btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisMonth}>Ce mois</button>
            {showPeriodFilter && <>
              <button className={`btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisWeek}>Cette semaine</button>
              <button className={`btn btn-sm ${period === 'year' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisYear}>Cette année</button>
            </>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : ranking.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-text">Aucun SDR actif pour cette période.</div>
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 1 && (
            <div className="card mb-16" style={{ paddingBottom: 0, overflow: 'hidden', position: 'relative' }}>
              {!isSdr && topAppels.length >= 1 && (
                <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, gap: 2 }}>
                  {[
                    { key: 'rdv',    label: '🏆 RDV'   },
                    { key: 'appels', label: '📞 Appels' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setPodiumTab(t.key)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', border: 'none', transition: 'all .15s',
                      background: podiumTab === t.key ? (t.key === 'appels' ? '#f97316' : 'var(--primary)') : 'transparent',
                      color: podiumTab === t.key ? '#fff' : 'var(--text-muted)',
                    }}>{t.label}</button>
                  ))}
                </div>
              )}
              {podiumTab === 'rdv'
                ? <Podium top3={top3} showAppels={false} metric="rdv" />
                : <Podium top3={topAppels} showAppels={false} metric="appels" />
              }
            </div>
          )}

          {/* Tableau complet */}
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SDR</th>
                    <th>Marché</th>
                    {!isSdr && <th style={{ textAlign: 'right' }}>RDV Pris</th>}
                    {!isSdr && <th style={{ textAlign: 'right' }}>RDV Done</th>}
                    {!isSdr && <th style={{ textAlign: 'right' }}>Objectif</th>}
                    {!isSdr && <th style={{ textAlign: 'right', color: '#f97316' }}>📞 Appels</th>}
                    <th>Score</th>
                    <th>Progression</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const isMe = r.id === user?.id;
                    const scaledObj = scaleObjectif(r.objectif, period, start, end);
                    const pct   = scaledObj > 0 ? Math.round((r.rdv_done / scaledObj) * 100) : 0;
                    const color = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <tr key={r.id} style={isMe ? { background: 'var(--primary-light)' } : {}}>
                        <td>
                          <div className="rank-badge" style={{
                            background: r.rank <= 3 ? 'var(--warning-light)' : 'var(--surface2)',
                            color: r.rank <= 3 ? 'var(--warning)' : 'var(--text-muted)',
                          }}>
                            {MEDALS[r.rank] || r.rank}
                          </div>
                        </td>
                        <td>
                          {isSdr ? (
                            <span style={{ fontWeight: isMe ? 700 : 500, display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px' }}>
                              <Avatar src={r.avatar} name={r.name} size={28} rank={r.rank} />
                              {r.name} {isMe && <span className="badge badge-blue">Moi</span>}
                            </span>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontWeight: isMe ? 700 : 500, padding: '2px 6px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                              onClick={() => setSelectedSdr({ ...r })}
                            >
                              <Avatar src={r.avatar} name={r.name} size={28} rank={r.rank} />
                              {r.name} {isMe && <span className="badge badge-blue">Moi</span>}
                            </button>
                          )}
                        </td>
                        <td>
                          {r.marche_name
                            ? <span className="flex items-center gap-8"><span className="marche-dot" style={{ background: r.marche_color }} />{r.marche_name}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        {!isSdr && <td style={{ textAlign: 'right' }}>{r.rdv_pris}</td>}
                        {!isSdr && <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{r.rdv_done}</td>}
                        {!isSdr && <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{scaledObj}</td>}
                        {!isSdr && (
                          <td style={{ textAlign: 'right', fontWeight: 700, color: r.total_appels > 0 ? '#f97316' : 'var(--text-muted)' }}>
                            {r.total_appels > 0 ? r.total_appels : '—'}
                          </td>
                        )}
                        <td style={{ fontWeight: 700, color, minWidth: 60 }}>{pct}%</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedSdr && (
        <SdrModal sdr={selectedSdr} start={start} end={end} onClose={() => setSelectedSdr(null)} />
      )}
    </div>
  );
}
