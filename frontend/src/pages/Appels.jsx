import { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';

function isoWeekOf(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const y = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  return { week: Math.ceil(((date - yearStart) / 86400000 + 1) / 7), year: y };
}

function weeksOfMonth(year, month) {
  const seen = new Set();
  const result = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const { week, year: wy } = isoWeekOf(d);
    const k = `${wy}-${week}`;
    if (!seen.has(k)) { seen.add(k); result.push({ week, year: wy, label: `S${week}` }); }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function parseKey(k) {
  const m = k.match(/^(.+)-(\d+)-(\d{4})$/);
  if (!m) return null;
  return { sdrId: m[1], week: parseInt(m[2]), year: parseInt(m[3]) };
}

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

export default function Appels() {
  const now = new Date();
  const [sdrs, setSdrs]           = useState([]);
  const [logs, setLogs]           = useState({});
  const [saving, setSaving]       = useState({});
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [search, setSearch]       = useState('');
  const [autoSave, setAutoSave]   = useState(true);
  const [touched, setTouched]     = useState(new Set());
  const [saveError, setSaveError] = useState('');

  const weeks = weeksOfMonth(selectedYear, selectedMonth);
  const currentWeek = isoWeekOf(now);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getCallLogs()])
      .then(([users, callLogs]) => {
        setSdrs(users.filter(u => u.role === 'sdr' && u.status === 'active'));
        const map = {};
        callLogs.forEach(l => { map[`${l.sdr_id}-${l.semaine}-${l.annee}`] = l.nb_appels; });
        setLogs(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const key = (sdrId, w) => `${sdrId}-${w.week}-${w.year}`;

  const handleChange = (k, value) => {
    setLogs(p => ({ ...p, [k]: value }));
    if (!autoSave) setTouched(prev => { const n = new Set(prev); n.add(k); return n; });
  };

  const handleBlur = async (sdrId, w) => {
    if (!autoSave) return;
    const k = key(sdrId, w);
    const val = parseInt(logs[k]) || 0;
    setSaving(p => ({ ...p, [k]: true }));
    setSaveError('');
    try {
      await api.saveCallLog(sdrId, w.week, w.year, val);
    } catch (err) {
      setSaveError(err.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(p => ({ ...p, [k]: false }));
    }
  };

  const saveAll = async () => {
    if (!touched.size) return;
    setSavingAll(true);
    await Promise.all([...touched].map(k => {
      const parsed = parseKey(k);
      if (!parsed) return Promise.resolve();
      return api.saveCallLog(parsed.sdrId, parsed.week, parsed.year, parseInt(logs[k]) || 0).catch(() => {});
    }));
    setSavingAll(false);
    setTouched(new Set());
  };

  const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filteredSdrs = useMemo(() => sdrs.filter(s => norm(s.name).includes(norm(search))), [sdrs, search]);

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">📞 Appels</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Barre de contrôles ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Sélecteur année */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setSelectedYear(y => y - 1)}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: 'center' }}>{selectedYear}</span>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} disabled={selectedYear >= now.getFullYear()} onClick={() => setSelectedYear(y => y + 1)}>›</button>
          </div>

          {/* Sélecteur mois */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {MONTHS.map((m, i) => {
              const isCur = i === now.getMonth() && selectedYear === now.getFullYear();
              const isSel = i === selectedMonth;
              return (
                <button key={i} onClick={() => setSelectedMonth(i)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: isSel ? 700 : 500, cursor: 'pointer',
                  background: isSel ? 'var(--primary)' : 'transparent',
                  color: isSel ? '#fff' : isCur ? 'var(--primary)' : 'var(--text-muted)',
                  border: `1.5px solid ${isSel ? 'var(--primary)' : isCur ? 'var(--primary)55' : 'var(--border)'}`,
                  transition: 'all .15s',
                }}>{m}</button>
              );
            })}
          </div>
        </div>

        {/* ── Barre recherche + toggle ── */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: '0 1 280px' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input
              className="form-input"
              placeholder="Rechercher un SDR…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, height: 34 }}
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Bouton Sauvegarder — visible seulement si autoSave OFF et changements en attente */}
            {!autoSave && touched.size > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={saveAll}
                disabled={savingAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {savingAll ? <span className="spinner" style={{ width: 13, height: 13 }} /> : '💾'}
                Sauvegarder ({touched.size})
              </button>
            )}

            {/* Toggle auto-save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Sauvegarde auto</span>
              <div
                onClick={() => { setAutoSave(v => !v); setTouched(new Set()); }}
                style={{
                  width: 40, height: 22, borderRadius: 99, cursor: 'pointer', position: 'relative', transition: 'background .2s',
                  background: autoSave ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: autoSave ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                }} />
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="alert alert-danger" style={{ margin: '8px 16px', borderRadius: 6 }}>
            Erreur de sauvegarde : {saveError}
            <button onClick={() => setSaveError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* ── Tableau ── */}
        <div className="table-wrap">
          <table className="admin-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>SDR {filteredSdrs.length < sdrs.length && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({filteredSdrs.length})</span>}</th>
                {weeks.map(w => {
                  const isCur = w.week === currentWeek.week && w.year === currentWeek.year;
                  return (
                    <th key={`${w.week}-${w.year}`} style={{ textAlign: 'center', minWidth: 90 }}>
                      <span style={{ color: isCur ? 'var(--primary)' : undefined, fontWeight: isCur ? 700 : undefined }}>{w.label}</span>
                      {isCur && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--primary)' }}>cette sem.</div>}
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', minWidth: 80 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSdrs.map(sdr => {
                const total = weeks.reduce((s, w) => s + (parseInt(logs[key(sdr.id, w)]) || 0), 0);
                return (
                  <tr key={sdr.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sdr.name}</div>
                      {sdr.marche_name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="marche-dot" style={{ background: sdr.marche_color, width: 7, height: 7 }} />
                          {sdr.marche_name}
                        </div>
                      )}
                    </td>
                    {weeks.map(w => {
                      const k = key(sdr.id, w);
                      const isCur = w.week === currentWeek.week && w.year === currentWeek.year;
                      const isDirty = !autoSave && touched.has(k);
                      return (
                        <td key={k} style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <input
                            type="number"
                            min="0"
                            value={logs[k] ?? ''}
                            placeholder="—"
                            onChange={e => handleChange(k, e.target.value)}
                            onBlur={() => handleBlur(sdr.id, w)}
                            style={{
                              width: 64, textAlign: 'center', fontSize: 14, fontWeight: 600,
                              background: isCur ? 'var(--primary)10' : 'transparent',
                              border: `1.5px solid ${saving[k] ? 'var(--primary)' : isDirty ? '#f97316' : 'var(--border)'}`,
                              borderRadius: 6, padding: '5px 6px', color: 'var(--text)',
                              outline: 'none', transition: 'border-color .15s',
                            }}
                          />
                          {saving[k] && <span style={{ fontSize: 9, color: 'var(--primary)', display: 'block', marginTop: 1 }}>✓</span>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: total > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {total || '—'}
                    </td>
                  </tr>
                );
              })}
              {filteredSdrs.length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    {search ? `Aucun SDR trouvé pour "${search}".` : 'Aucun SDR actif.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
