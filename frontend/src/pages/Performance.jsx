import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.js';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

function SdrCombobox({ sdrs, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const selected = sdrs.find(s => s.id === value);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = query.trim()
    ? sdrs.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : sdrs;

  return (
    <div ref={ref} style={{ position: 'relative', width: 240 }}>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          style={{ width: '100%', paddingRight: 28 }}
          placeholder="👥 Tous les SDRs"
          value={open ? query : (selected ? selected.name : '')}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(''); }}
        />
        {(selected || query) && (
          <button
            onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 2, lineHeight: 1 }}
          >✕</button>
        )}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
          <div onMouseDown={() => { onChange(''); setQuery(''); setOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: !value ? 600 : 400, color: !value ? 'var(--primary)' : undefined }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            👥 Tous les SDRs
          </div>
          {filtered.length === 0
            ? <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>Aucun résultat</div>
            : filtered.map(s => (
              <div key={s.id} onMouseDown={() => { onChange(s.id); setQuery(''); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: s.id === value ? 600 : 400, color: s.id === value ? 'var(--primary)' : undefined }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                {s.marche_color && <span className="marche-dot" style={{ background: s.marche_color, width: 7, height: 7, flexShrink: 0 }} />}
                <span>{s.name}</span>
                {s.marche_name && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{s.marche_name}</span>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

function getWeekRange(weekStr, year) {
  const w = parseInt(weekStr, 10);
  const y = parseInt(year, 10);
  const jan1 = new Date(y, 0, 1);
  const daysToFirstMonday = (1 - jan1.getDay() + 7) % 7;
  const firstMonday = new Date(y, 0, 1 + daysToFirstMonday);
  let weekStart, weekEnd;
  if (w === 0) {
    weekStart = new Date(y, 0, 1);
    weekEnd = new Date(firstMonday); weekEnd.setDate(weekEnd.getDate() - 1);
  } else {
    weekStart = new Date(firstMonday); weekStart.setDate(firstMonday.getDate() + (w - 1) * 7);
    weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  }
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  return `${fmt(weekStart)} au ${fmt(weekEnd)}`;
}

function formatLabel(label, period) {
  if (period === 'week')  return `S${label}`;
  if (period === 'month') return MONTH_LABELS[parseInt(label, 10) - 1] ?? label;
  return label;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

const APPEL_COLOR = '#f97316';

const VIEW_OPTS = [
  { key: 'rdv',    label: '📋 RDV'        },
  { key: 'appels', label: '📞 Appels'      },
  { key: 'both',   label: '📋+📞 Les deux' },
];

export default function Performance() {
  const now = new Date();
  const [period, setPeriod]     = useState('month');
  const [year, setYear]         = useState(String(now.getFullYear()));
  const [sdrId, setSdrId]       = useState('');
  const [sdrs, setSdrs]         = useState([]);
  const [data, setData]         = useState([]);
  const [objectif, setObjectif] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [view, setView]         = useState('rdv');

  const showRdv    = view === 'rdv'    || view === 'both';
  const showAppels = view === 'appels' || view === 'both';

  useEffect(() => {
    api.getUsers().then(users => setSdrs(users.filter(u => u.role === 'sdr' && u.status === 'active')));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { period, year };
    if (sdrId) params.sdr_id = sdrId;
    api.getPerformance(params)
      .then(res => {
        setObjectif(res.objectif ?? null);
        setData((res.rows ?? res).map(r => ({ ...r, rawLabel: r.label, label: formatLabel(r.label, period) })));
      })
      .finally(() => setLoading(false));
  }, [period, year, sdrId]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  const totalPris      = data.reduce((s, r) => s + (r.pris      || 0), 0);
  const totalDone      = data.reduce((s, r) => s + (r.done      || 0), 0);
  const totalNoShow    = data.reduce((s, r) => s + (r.no_show   || 0), 0);
  const totalAppels    = data.reduce((s, r) => s + (r.appels    || 0), 0);
  const totalObjectif  = data.reduce((s, r) => s + (r.objectif  || 0), 0);
  const convRate       = totalObjectif > 0
    ? Math.round((totalDone / totalObjectif) * 100)
    : (totalPris > 0 ? Math.round((totalDone / totalPris) * 100) : 0);
  const ratioAppels    = totalDone > 0 ? (totalAppels / totalDone).toFixed(1) : '—';

  const selectedSdr = sdrs.find(s => s.id === sdrId);

  // KPI cards selon le mode
  const kpis = [
    ...(showRdv ? [
      { label: 'RDV Pris',   value: totalPris,   color: '#6366f1' },
      { label: 'RDV Done',   value: totalDone,   color: '#22c55e' },
      { label: 'No Show',    value: totalNoShow, color: '#f59e0b' },
      { label: 'Taux Done',  value: `${convRate}%`, color: convRate >= 70 ? '#22c55e' : convRate >= 40 ? '#f59e0b' : '#ef4444' },
    ] : []),
    ...(showAppels ? [
      { label: 'Total Appels', value: totalAppels, color: APPEL_COLOR },
      ...(showRdv && totalDone > 0
        ? [{ label: 'Appels / RDV', value: ratioAppels, color: APPEL_COLOR, sub: 'moy. pour décrocher' }]
        : !showRdv ? [{ label: 'Appels / Done', value: ratioAppels, color: APPEL_COLOR, sub: 'moy. pour décrocher' }] : []
      ),
    ] : []),
  ];

  // Séries du graphique
  const ChartEl = chartType === 'line' ? Line : Bar;
  const commonProps = chartType === 'bar'
    ? { radius: [4, 4, 0, 0], maxBarSize: view === 'both' ? 32 : 48 }
    : { strokeWidth: 2.5, dot: { r: 4 }, activeDot: { r: 6 } };

  const hasDualAxis = view === 'both';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">📊 Performances</div>
          <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{selectedSdr ? `SDR : ${selectedSdr.name}` : 'Tous les SDRs'}</span>
            {selectedSdr?.marche_name && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                · <span className="marche-dot" style={{ background: selectedSdr.marche_color, width: 7, height: 7 }} />
                {selectedSdr.marche_name}
              </span>
            )}
            {period !== 'year' && <span>· {year}</span>}
          </div>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-12 flex-wrap">

          {/* Période */}
          <div className="flex gap-8">
            {[{ key: 'week', label: 'Semaine' }, { key: 'month', label: 'Mois' }, { key: 'year', label: 'Année' }].map(p => (
              <button key={p.key} className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>

          {/* Année */}
          {period !== 'year' && (
            <select className="form-input" style={{ width: 110, padding: '6px 10px' }} value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {/* SDR */}
          <SdrCombobox sdrs={sdrs} value={sdrId} onChange={setSdrId} />

          {/* Vue RDV / Appels / Les deux */}
          <div style={{ display: 'flex', gap: 4, padding: '3px', background: 'var(--surface2)', borderRadius: 10 }}>
            {VIEW_OPTS.map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: view === v.key ? 700 : 500,
                  cursor: 'pointer', border: 'none', transition: 'all .15s',
                  background: view === v.key ? 'var(--primary)' : 'transparent',
                  color: view === v.key ? '#fff' : 'var(--text-muted)',
                }}
              >{v.label}</button>
            ))}
          </div>

          {/* Type graphique */}
          <div className="flex gap-8" style={{ marginLeft: 'auto' }}>
            <button className={`btn btn-sm ${chartType === 'bar'  ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('bar')}  title="Barres">▐▌</button>
            <button className={`btn btn-sm ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('line')} title="Courbes">〜</button>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="flex gap-16 flex-wrap mb-16">
        {kpis.map(k => (
          <div key={k.label} style={{ flex: '1 1 140px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${k.color}` }}>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Graphique ── */}
      <div className="card mb-16" style={{ padding: '24px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 360 }}><div className="spinner" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 360 }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">Aucune donnée pour cette période.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={data} margin={{ top: 10, right: hasDualAxis ? 50 : 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              {hasDualAxis && (
                <YAxis yAxisId="right" orientation="right" tick={{ fill: APPEL_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Appels', angle: 90, position: 'insideRight', fill: APPEL_COLOR, fontSize: 11, dx: 14 }} />
              )}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16 }} />

              {showRdv && chartType === 'bar' && <>
                <Bar yAxisId="left" dataKey="pris"    name="RDV Pris" fill="#6366f1" radius={[4,4,0,0]} maxBarSize={hasDualAxis ? 32 : 48} />
                <Bar yAxisId="left" dataKey="done"    name="RDV Done" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={hasDualAxis ? 32 : 48} />
                <Bar yAxisId="left" dataKey="no_show" name="No Show"  fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={hasDualAxis ? 32 : 48} />
              </>}
              {showRdv && chartType === 'line' && <>
                <Line yAxisId="left" dataKey="pris"    name="RDV Pris" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="left" dataKey="done"    name="RDV Done" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="left" dataKey="no_show" name="No Show"  stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </>}

              {showAppels && chartType === 'bar' && (
                <Bar yAxisId={hasDualAxis ? 'right' : 'left'} dataKey="appels" name="Appels" fill={APPEL_COLOR} radius={[4,4,0,0]} maxBarSize={hasDualAxis ? 32 : 48} />
              )}
              {showAppels && chartType === 'line' && (
                <Line yAxisId={hasDualAxis ? 'right' : 'left'} dataKey="appels" name="Appels" stroke={APPEL_COLOR} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray={hasDualAxis ? '6 3' : undefined} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tableau récap ── */}
      {data.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{period === 'week' ? 'Semaine' : period === 'month' ? 'Mois' : 'Année'}</th>
                  {period === 'week' && <th className="text-muted">Période</th>}
                  {showRdv && <>
                    <th style={{ textAlign: 'right' }}>RDV Pris</th>
                    <th style={{ textAlign: 'right' }}>RDV Done</th>
                    <th style={{ textAlign: 'right' }}>No Show</th>
                    <th style={{ textAlign: 'right' }}>Taux / Pris</th>
                    <th style={{ textAlign: 'right' }}>Taux / Objectif</th>
                  </>}
                  {showAppels && <th style={{ textAlign: 'right', color: APPEL_COLOR }}>📞 Appels</th>}
                  {showRdv && showAppels && <th style={{ textAlign: 'right', color: APPEL_COLOR }}>Appels / Done</th>}
                </tr>
              </thead>
              <tbody>
                {data.map(row => {
                  const rateObj  = row.objectif > 0 ? Math.round((row.done / row.objectif) * 100) : null;
                  const ratePris = row.pris > 0 ? Math.round((row.done / row.pris) * 100) : 0;
                  const colorObj  = rateObj != null ? (rateObj >= 100 ? '#22c55e' : rateObj >= 60 ? '#f59e0b' : '#ef4444') : 'var(--text-muted)';
                  const colorPris = ratePris >= 100 ? '#22c55e' : ratePris >= 60 ? '#f59e0b' : '#ef4444';
                  const appelPerDone = row.done > 0 ? (row.appels / row.done).toFixed(1) : '—';
                  return (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 600 }}>{row.label}</td>
                      {period === 'week' && <td className="text-muted text-sm">{getWeekRange(row.rawLabel, year)}</td>}
                      {showRdv && <>
                        <td style={{ textAlign: 'right' }}>{row.pris}</td>
                        <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>{row.done}</td>
                        <td style={{ textAlign: 'right', color: '#f59e0b' }}>{row.no_show}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: colorPris }}>{ratePris}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: colorObj }}>
                          {rateObj != null
                            ? <>{rateObj}% <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>/ obj.{row.objectif}</span></>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                      </>}
                      {showAppels && (
                        <td style={{ textAlign: 'right', fontWeight: 700, color: row.appels > 0 ? APPEL_COLOR : 'var(--text-muted)' }}>
                          {row.appels || '—'}
                        </td>
                      )}
                      {showRdv && showAppels && (
                        <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{appelPerDone}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
