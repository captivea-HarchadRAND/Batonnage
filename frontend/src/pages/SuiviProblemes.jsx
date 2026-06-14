import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function IssueBadge({ type, typesMap }) {
  const t = typesMap[type] || { label: type, icon: '❓', color: 'var(--text-muted)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: t.color + '22', color: t.color, border: `1px solid ${t.color}44`,
    }}>
      {t.icon} {t.label}
    </span>
  );
}

const STATUS_TABS = [
  { key: 'open',      label: 'Ouverts',  icon: '🔓' },
  { key: 'dismissed', label: 'Traités',  icon: '✅' },
  { key: 'archived',  label: 'Archivés', icon: '📁' },
  { key: 'all',       label: 'Tous',     icon: '📋' },
];

export default function SuiviProblemes() {
  const now = new Date();
  const [issues, setIssues]         = useState([]);
  const [sdrs, setSdrs]             = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [sdrId, setSdrId]           = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusTab, setStatusTab]   = useState('open');
  const [start, setStart] = useState(localDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd]     = useState(localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actioning, setActioning]   = useState({});

  useEffect(() => {
    api.getUsers().then(u => setSdrs(u.filter(x => x.role === 'sdr' && x.status === 'active')));
    api.getCallIssueTypes().then(setIssueTypes);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { status: statusTab };
    if (start)  params.start  = start;
    if (end)    params.end    = end;
    if (sdrId)  params.sdr_id = sdrId;
    api.getCallIssues(params).then(setIssues).finally(() => setLoading(false));
  }, [start, end, sdrId, statusTab]);

  useEffect(() => { load(); }, [load]);

  const filtered = typeFilter ? issues.filter(i => i.issue_type === typeFilter) : issues;
  const typesMap = issueTypes.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
  const counts   = issueTypes.reduce((acc, t) => {
    acc[t.id] = issues.filter(i => i.issue_type === t.id).length;
    return acc;
  }, {});

  const setAction = (id, val) => setActioning(p => ({ ...p, [id]: val }));

  const handleStatus = async (issue, newStatus) => {
    setAction(issue.id, newStatus);
    try {
      await api.updateCallIssueStatus(issue.id, newStatus);
      setIssues(prev => prev.filter(i => i.id !== issue.id));
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally { setAction(issue.id, null); }
  };

  const handleDelete = async (id) => {
    setAction(id, 'delete');
    try {
      await api.deleteCallIssue(id);
      setIssues(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setAction(id, null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">🔍 Suivi Problèmes SDR</div>
          <div className="text-muted text-sm">{filtered.length} problème{filtered.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-16 flex-wrap mb-16">
        {issueTypes.map(t => (
          <div key={t.id} onClick={() => setTypeFilter(typeFilter === t.id ? '' : t.id)}
            style={{
              flex: '1 1 140px', background: 'var(--surface)',
              border: `1px solid ${typeFilter === t.id ? t.color : 'var(--border)'}`,
              borderLeft: `4px solid ${t.color}`,
              borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
              opacity: typeFilter && typeFilter !== t.id ? 0.5 : 1,
              transition: 'opacity .15s, border-color .15s',
            }}>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{t.icon} {t.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.color }}>{counts[t.id] || 0}</div>
          </div>
        ))}
      </div>

      {/* Onglets statut */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setStatusTab(tab.key)}
            className={`btn btn-sm ${statusTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-12 flex-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="text-sm text-muted">Du</label>
            <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: 150, padding: '4px 8px' }} />
            <label className="text-sm text-muted">Au</label>
            <input className="form-input" type="date" value={end}   onChange={e => setEnd(e.target.value)}   style={{ width: 150, padding: '4px 8px' }} />
          </div>
          <select className="form-input" value={sdrId} onChange={e => setSdrId(e.target.value)} style={{ width: 200, padding: '4px 8px' }}>
            <option value="">👥 Tous les SDRs</option>
            {sdrs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 220, padding: '4px 8px' }}>
            <option value="">🔎 Tous les types</option>
            {issueTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          {(typeFilter || sdrId) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter(''); setSdrId(''); }}>✕ Réinitialiser</button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">Aucun problème signalé sur cette période.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SDR</th>
                  <th>Marché</th>
                  <th>Type de problème</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right', minWidth: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => {
                  const status = issue.status || 'open';
                  const isDeleting = confirmDelete === issue.id;
                  const busy = actioning[issue.id];
                  return (
                    <tr key={issue.id}>
                      <td style={{ fontWeight: 600 }}>{issue.sdr_name}</td>
                      <td>
                        {issue.marche_name
                          ? <span className="flex items-center gap-8"><span className="marche-dot" style={{ background: issue.marche_color }} />{issue.marche_name}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td><IssueBadge type={issue.issue_type} typesMap={typesMap} /></td>
                      <td className="text-muted text-sm">
                        {issue.date ? new Date(issue.date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>
                        {issue.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>

                          {/* Dismiss / Réouvrir */}
                          {status === 'open' && (
                            <button
                              title="Marquer comme traité"
                              disabled={!!busy}
                              onClick={() => handleStatus(issue, 'dismissed')}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 13, color: '#22c55e', borderColor: '#22c55e44' }}
                            >
                              {busy === 'dismissed' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✅ Traité'}
                            </button>
                          )}
                          {(status === 'dismissed' || status === 'archived') && (
                            <button
                              title="Réouvrir"
                              disabled={!!busy}
                              onClick={() => handleStatus(issue, 'open')}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 13 }}
                            >
                              {busy === 'open' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🔓 Réouvrir'}
                            </button>
                          )}

                          {/* Archiver / Désarchiver */}
                          {status !== 'archived' && (
                            <button
                              title="Archiver"
                              disabled={!!busy}
                              onClick={() => handleStatus(issue, 'archived')}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 13 }}
                            >
                              {busy === 'archived' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '📁'}
                            </button>
                          )}
                          {status === 'archived' && (
                            <button
                              title="Désarchiver"
                              disabled={!!busy}
                              onClick={() => handleStatus(issue, 'open')}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 13 }}
                            >
                              {busy === 'open' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '📂'}
                            </button>
                          )}

                          {/* Supprimer */}
                          {!isDeleting ? (
                            <button
                              title="Supprimer"
                              disabled={!!busy}
                              onClick={() => setConfirmDelete(issue.id)}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 13, color: '#ef4444', borderColor: '#ef444444' }}
                            >🗑️</button>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: '#ef4444' }}>Confirmer ?</span>
                              <button
                                onClick={() => handleDelete(issue.id)}
                                disabled={!!busy}
                                className="btn btn-sm"
                                style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: 12 }}
                              >
                                {busy === 'delete' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Oui'}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="btn btn-sm btn-ghost"
                                style={{ fontSize: 12 }}
                              >Non</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
