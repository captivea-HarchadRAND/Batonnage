import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';

function scaleObjectif(objectif, period) {
  if (period === 'week') return Math.round(objectif / 4);
  return objectif;
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

function getRatioColor(ratio) {
  if (ratio >= 1) return 'var(--success)';
  if (ratio >= 0.6) return 'var(--warning)';
  return 'var(--danger)';
}

export default function Synthesis() {
  const now = new Date();
  const thisMonthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisMonthEnd   = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [start, setStart] = useState(thisMonthStart);
  const [end, setEnd]     = useState(thisMonthEnd);
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'year' | 'custom'
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getSynthesis({ start, end })
      .then(setGroups)
      .finally(() => setLoading(false));
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const totalPris = groups.reduce((s, g) => s + g.total_pris, 0);
  const totalDone = groups.reduce((s, g) => s + g.total_done, 0);

  const setThisWeek = () => {
    setStart(getMonday(now)); setEnd(getSunday(now)); setPeriod('week');
  };
  const setThisMonth = () => {
    setStart(thisMonthStart); setEnd(thisMonthEnd); setPeriod('month');
  };
  const setThisYear = () => {
    setStart(`${now.getFullYear()}-01-01`);
    setEnd(`${now.getFullYear()}-12-31`);
    setPeriod('year');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">📈 Synthesis</div>
        <div className="text-muted text-sm">
          Total : <strong style={{ color: 'var(--primary)' }}>{totalPris} pris</strong>
          {' · '}
          <strong style={{ color: 'var(--success)' }}>{totalDone} done</strong>
        </div>
      </div>

      {/* Filtres date */}
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
            <button className={`btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisWeek}>Cette semaine</button>
            <button className={`btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisMonth}>Ce mois</button>
            <button className={`btn btn-sm ${period === 'year' ? 'btn-primary' : 'btn-ghost'}`} onClick={setThisYear}>Cette année</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">Aucun SDR actif avec des données sur cette période.</div>
        </div>
      ) : (
        <div className="synthesis-table-wrap">
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '190px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '160px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>SDR</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>RDV Pris</th>
                <th style={{ textAlign: 'right' }}>RDV Done</th>
                <th style={{ textAlign: 'right' }}>Objectif</th>
                <th style={{ textAlign: 'right' }}>% Objectif</th>
                <th>Progression</th>
              </tr>
            </thead>
            {groups.map(group => (
              <tbody key={group.marche_id}>
                <tr className="synthesis-group-row">
                  <td colSpan={7} style={{ background: 'var(--surface2)', padding: '8px 12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="marche-dot" style={{ background: group.marche_color, width: 10, height: 10, flexShrink: 0 }} />
                      <span className="synthesis-group-name">{group.marche_name}</span>
                      <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>
                        {group.total_pris} pris · {group.total_done} done
                      </span>
                    </span>
                  </td>
                </tr>
                {group.sdrs.map(sdr => {
                  const scaledObj = scaleObjectif(sdr.objectif, period);
                  const pct = scaledObj > 0 ? Math.round((sdr.rdv_done / scaledObj) * 100) : 0;
                  const ratio = scaledObj > 0 ? sdr.rdv_done / scaledObj : 0;
                  const color = getRatioColor(ratio);
                  return (
                    <tr key={sdr.sdr_id}>
                      <td style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sdr.sdr_name}</td>
                      <td className="text-muted text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sdr.sdr_email}</td>
                      <td style={{ textAlign: 'right' }}>{sdr.rdv_pris}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{sdr.rdv_done}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{scaledObj}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color }}>{pct}%</td>
                      <td>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

    </div>
  );
}
