import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';
import { safeUrl } from '../utils.js';

function ConfirmModal({ title, message, confirmLabel, confirmClass = 'btn-danger', icon, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          {icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>}
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
          <div className="text-muted text-sm" style={{ lineHeight: 1.6 }}>{message}</div>
        </div>
        <div className="flex gap-8" style={{ justifyContent: 'center', paddingTop: 8 }}>
          <button className="btn btn-ghost" style={{ minWidth: 100 }} onClick={onClose}>Annuler</button>
          <button className={`btn ${confirmClass}`} style={{ minWidth: 100 }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function norm(str) {
  return (str ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function MarkDoneModal({ rdv, onClose, onSaved }) {
  const [form, setForm] = useState({
    crm_url_done: rdv.crm_url_done || '',
    date_done: rdv.date_done ? rdv.date_done.split('T')[0] : new Date().toISOString().split('T')[0],
    notes: rdv.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const getCrmId = (url) => url?.match(/\/crm\/(\d+)/)?.[1] ?? null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const doneId = getCrmId(form.crm_url_done);
    const prisId = getCrmId(rdv.crm_url_pris);
    if (!doneId) {
      setError('URL invalide — le lien doit contenir /crm/{ID}, ex: https://www.captivea.com/odoo/crm/123456');
      return;
    }
    if (prisId && doneId !== prisId) {
      setError(`L'ID CRM ne correspond pas — le lien Pris contient l'ID ${prisId}, le lien Done doit contenir le même ID.`);
      return;
    }
    setLoading(true);
    try { onSaved(await api.updateRdv(rdv.id, form)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✅ Marquer comme Done</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">URL Odoo CRM (Done)</label>
            <input className="form-input" type="text" value={form.crm_url_done} onChange={set('crm_url_done')}
              placeholder="https://www.captivea.com/odoo/crm/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Done le</label>
            <input className="form-input" type="date" value={form.date_done} onChange={set('date_done')} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={set('notes')} placeholder="Ex: 1 vente..." />
          </div>
          <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Confirmer Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoShowModal({ rdv, onClose, onSaved }) {
  const [choice, setChoice] = useState(''); // 'reschedule' | 'lost'
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!choice) { setError('Choisissez une option.'); return; }
    if (choice === 'reschedule' && !newDate) { setError('Veuillez saisir la nouvelle date prévue.'); return; }
    setLoading(true);
    try {
      let updated;
      if (choice === 'reschedule') {
        updated = await api.updateRdv(rdv.id, { date_prevue: newDate });
      } else {
        updated = await api.updateRdv(rdv.id, { status: 'no_show' });
      }
      onSaved(updated);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">⚠️ No Show — {rdv.sdr_name || 'RDV'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
            border: `2px solid ${choice === 'reschedule' ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s',
          }}>
            <input type="radio" name="ns_choice" value="reschedule" checked={choice === 'reschedule'}
              onChange={() => setChoice('reschedule')} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>🔄 À replanifier</div>
              <div className="text-muted text-sm">Le prospect n'était pas disponible — on fixe une nouvelle date.</div>
            </div>
          </label>

          {choice === 'reschedule' && (
            <div className="form-group" style={{ marginLeft: 28 }}>
              <label className="form-label">Nouvelle date prévue</label>
              <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: 200 }} />
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
            border: `2px solid ${choice === 'lost' ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s',
          }}>
            <input type="radio" name="ns_choice" value="lost" checked={choice === 'lost'}
              onChange={() => setChoice('lost')} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>❌ Lost prospect</div>
              <div className="text-muted text-sm">Le prospect est perdu — le RDV passe en statut No Show.</div>
            </div>
          </label>
        </div>

        <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button
            className={`btn ${choice === 'lost' ? 'btn-danger' : 'btn-primary'}`}
            disabled={loading || !choice}
            onClick={handleConfirm}
          >
            {loading ? <span className="spinner" /> : choice === 'lost' ? 'Confirmer Lost' : 'Replanifier'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RdvRows({ rdvs, showSdr, onMarkDone, onNoShow, isAdmin, selected, onToggle }) {
  const todayStr = new Date().toISOString().split('T')[0];
  return rdvs.map(rdv => {
    const isPris = rdv.status === 'pris' || (!rdv.status || rdv.status === '');
    const isDone = rdv.status === 'done';
    const isNoShow = rdv.status === 'no_show';
    const isOverdue = isPris && rdv.date_prevue && rdv.date_prevue < todayStr && !rdv.archived;
    const rowBg = selected?.has(rdv.id) ? 'var(--primary-light)' : '';
    return (
      <tr key={rdv.id}
        className={isOverdue ? 'rdv-overdue' : ''}
        style={{ opacity: rdv.archived ? 0.6 : 1, background: rowBg }}
      >
        <td style={{ width: 36, paddingRight: 0 }}>
          <input
            type="checkbox"
            checked={selected?.has(rdv.id) ?? false}
            onChange={() => onToggle(rdv.id)}
            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--primary)' }}
          />
        </td>
        {showSdr && <td style={{ fontWeight: 600 }}>{rdv.sdr_name}</td>}
        <td>
          <span className="flex items-center gap-8">
            <span className="marche-dot" style={{ background: rdv.marche_color }} />
            {rdv.marche_name}
          </span>
        </td>
        <td className="text-muted text-sm">S{rdv.semaine}</td>
        <td>{rdv.date_pris ? new Date(rdv.date_pris).toLocaleDateString('fr-FR') : '—'}</td>
        <td>{rdv.date_prevue ? new Date(rdv.date_prevue).toLocaleDateString('fr-FR') : '—'}</td>
        <td>{rdv.date_done ? new Date(rdv.date_done).toLocaleDateString('fr-FR') : '—'}</td>
        <td>
          {isDone && <span className="badge badge-green">✓ Done</span>}
          {isNoShow && <span className="badge" style={{ background: 'var(--warning)', color: '#000' }}>No Show</span>}
          {!isDone && !isNoShow && <span className="badge badge-blue">Pris</span>}
        </td>
        <td>
          {safeUrl(rdv.crm_url_pris)
            ? <a href={safeUrl(rdv.crm_url_pris)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">↗</a>
            : '—'}
        </td>
        <td>
          {safeUrl(rdv.crm_url_done)
            ? <a href={safeUrl(rdv.crm_url_done)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">↗</a>
            : '—'}
        </td>
        <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rdv.notes || '—'}
        </td>
        <td>
          <div className="flex gap-8" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            {!isDone && !isNoShow && !rdv.archived && (
              <button className="btn btn-success btn-sm" onClick={() => onMarkDone(rdv)}>Done</button>
            )}
            {!isDone && !isNoShow && !rdv.archived && (
              <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#000', border: 'none' }} onClick={() => onNoShow(rdv)}>No Show</button>
            )}
          </div>
        </td>
      </tr>
    );
  });
}

function TableHead({ showSdr, allSelected, onSelectAll }) {
  return (
    <thead>
      <tr>
        <th style={{ width: 36, paddingRight: 0 }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={e => onSelectAll(e.target.checked)}
            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--primary)' }}
          />
        </th>
        {showSdr && <th>SDR</th>}
        <th>Marché</th>
        <th>Sem.</th>
        <th>Pris le</th>
        <th>Prévu le</th>
        <th>Done le</th>
        <th>Statut</th>
        <th>CRM Pris</th>
        <th>CRM Done</th>
        <th>Notes</th>
        <th>Actions</th>
      </tr>
    </thead>
  );
}

export default function MesRdvs() {
  const { user } = useUser();
  const isAdmin = user?.role === 'manager' || user?.role === 'admin';

  const now = new Date();
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalRdv, setModalRdv] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noShowRdv, setNoShowRdv] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (showArchived) params.show_archived = '1';
    api.getRdvs(params).then(r => {
      setRdvs(r);
      const groups = {};
      r.forEach(x => { groups[x.sdr_id] = true; });
      setOpenGroups(groups);
    }).finally(() => setLoading(false));
  }, [start, end, showArchived]);

  const setThisWeek = () => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    const sun = new Date(d); sun.setDate(sun.getDate() + 6);
    setStart(localDate(d)); setEnd(localDate(sun));
  };
  const setThisMonth = () => {
    setStart(localDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEnd(localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };
  const setThisYear = () => {
    setStart(localDate(new Date(now.getFullYear(), 0, 1)));
    setEnd(localDate(new Date(now.getFullYear(), 11, 31)));
  };
  const clearDates = () => { setStart(''); setEnd(''); };

  const handleArchive = (id) => {
    const rdv = rdvs.find(r => r.id === id);
    const isArchived = rdv?.archived;
    setConfirmModal({
      icon: isArchived ? '📤' : '🗄️',
      title: isArchived ? 'Désarchiver ce RDV ?' : 'Archiver ce RDV ?',
      message: isArchived
        ? 'Ce RDV sera remis dans la liste principale.'
        : 'Ce RDV sera masqué de la liste principale. Vous pourrez le retrouver dans les archivés.',
      confirmLabel: isArchived ? 'Désarchiver' : 'Archiver',
      confirmClass: 'btn-ghost',
      onConfirm: async () => {
        await api.archiveRdv(id);
        setRdvs(prev => prev.filter(r => r.id !== id));
        setConfirmModal(null);
      },
    });
  };

  const handleDelete = (id) => {
    setConfirmModal({
      icon: '🗑️',
      title: 'Supprimer ce RDV ?',
      message: 'Cette action est irréversible. Le RDV sera définitivement supprimé.',
      confirmLabel: 'Supprimer',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await api.deleteRdv(id);
        setRdvs(prev => prev.filter(r => r.id !== id));
        setConfirmModal(null);
      },
    });
  };

  const handleSaved = (updated) => {
    setRdvs(prev => prev.map(r => r.id === updated.id ? updated : r));
    setModalRdv(null);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll = (rdvList, checked) => {
    if (checked) setSelected(new Set(rdvList.map(r => r.id)));
    else setSelected(new Set());
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDone = async () => {
    const ids = [...selected].filter(id => {
      const rdv = rdvs.find(r => r.id === id);
      return rdv && rdv.status !== 'done' && !rdv.archived;
    });
    if (!ids.length) return;
    setBulkLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.bulkDoneRdvs(ids, today);
      setRdvs(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'done', date_done: today } : r));
      clearSelection();
    } catch (e) { alert(e.message); }
    finally { setBulkLoading(false); }
  };

  const handleBulkArchive = async () => {
    const ids = [...selected];
    setBulkLoading(true);
    try {
      await api.bulkArchiveRdvs(ids);
      setRdvs(prev => showArchived
        ? prev.map(r => ids.includes(r.id) ? { ...r, archived: 1 } : r)
        : prev.filter(r => !ids.includes(r.id)));
      clearSelection();
    } catch (e) { alert(e.message); }
    finally { setBulkLoading(false); }
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    setConfirmModal({
      icon: '🗑️',
      title: `Supprimer ${ids.length} RDV${ids.length > 1 ? 's' : ''} ?`,
      message: 'Cette action est irréversible. Les RDVs sélectionnés seront définitivement supprimés.',
      confirmLabel: 'Supprimer',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          await api.bulkDeleteRdvs(ids);
          setRdvs(prev => prev.filter(r => !ids.includes(r.id)));
          clearSelection();
          setConfirmModal(null);
        } catch (e) { alert(e.message); setConfirmModal(null); }
        finally { setBulkLoading(false); }
      },
    });
  };

  const handleNoShow = (rdv) => setNoShowRdv(rdv);

  const handleNoShowSaved = (updated) => {
    setRdvs(prev => prev.map(r => r.id === updated.id ? updated : r));
    setNoShowRdv(null);
  };

  const toggleGroup = (sdrId) => setOpenGroups(p => ({ ...p, [sdrId]: !p[sdrId] }));

  const applyStatus = (list) => {
    if (statusFilter === 'all') return list;
    if (statusFilter === 'pris') return list.filter(r => r.status !== 'done' && r.status !== 'no_show');
    return list.filter(r => r.status === statusFilter);
  };

  // Autocomplete SDR
  const sdrNames = [...new Set(rdvs.map(r => r.sdr_name))].sort((a, b) => a.localeCompare(b));
  const suggestions = search.length >= 1
    ? sdrNames.filter(name => norm(name).includes(norm(search)) && norm(name) !== norm(search))
    : [];

  // Filtre SDR (recherche, insensible aux accents)
  const filteredBySdr = search
    ? rdvs.filter(r => norm(r.sdr_name).includes(norm(search)))
    : rdvs;

  // Stats globales
  const totalPris = rdvs.filter(r => r.crm_url_pris).length;
  const totalDone = rdvs.filter(r => r.status === 'done').length;

  // Stats filtrées (pour le résumé)
  const filteredPris = filteredBySdr.filter(r => r.crm_url_pris).length;
  const filteredDone = filteredBySdr.filter(r => r.status === 'done').length;

  // Groupes par SDR
  const bySdr = {};
  rdvs.forEach(r => {
    if (!bySdr[r.sdr_id]) {
      bySdr[r.sdr_id] = {
        sdrId: r.sdr_id, sdrName: r.sdr_name, sdrEmail: r.sdr_email,
        marcheColor: r.marche_color, marcheName: r.marche_name, rdvs: [],
      };
    }
    bySdr[r.sdr_id].rdvs.push(r);
  });

  const sdrGroups = Object.values(bySdr)
    .filter(g => !search || norm(g.sdrName).includes(norm(search)))
    .sort((a, b) => (a.marcheName || '').localeCompare(b.marcheName || '') || (a.sdrName || '').localeCompare(b.sdrName || ''));

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">📋 {isAdmin ? 'Tous les RDVs' : 'Mes RDVs'}</div>
          {isAdmin && (
            <div className="text-sm text-muted mt-8">
              <strong style={{ color: 'var(--primary)' }}>{totalPris} pris</strong>
              {' · '}
              <strong style={{ color: 'var(--success)' }}>{totalDone} done</strong>
              {' · '}{rdvs.length} total · {sdrGroups.length} SDRs
            </div>
          )}
        </div>

        <div className="flex gap-8 items-center flex-wrap">
          {isAdmin && (
            <div ref={searchRef} style={{ position: 'relative' }}>
              <input
                className="form-input"
                style={{ width: 220, paddingRight: search ? 28 : undefined }}
                placeholder="🔍 Rechercher un SDR..."
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setShowSuggestions(false); }}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 2 }}
                >✕</button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  marginTop: 4, maxHeight: 240, overflowY: 'auto',
                }}>
                  {suggestions.map(name => (
                    <div
                      key={name}
                      onMouseDown={() => { setSearch(name); setShowSuggestions(false); }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-8">
            {[
              { key: 'all', label: 'Tous' },
              { key: 'pris', label: 'Pris' },
              { key: 'done', label: 'Done' },
              { key: 'no_show', label: 'No Show' },
            ].map(f => (
              <button key={f.key}
                className={`btn btn-sm ${!showArchived && statusFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setStatusFilter(f.key); setShowArchived(false); }}>
                {f.label}
              </button>
            ))}
            <button
              className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowArchived(v => !v)}
              title="Voir les RDVs archivés"
            >🗄️ Archivés</button>
          </div>

          {isAdmin && (
            <div className="flex gap-8" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
              <button className={`btn btn-sm ${viewMode === 'sdr' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('sdr')}>👤 Par SDR</button>
              <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('list')}>☰ Liste</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Filtres date ── */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-12 flex-wrap">
          <div className="flex gap-8">
            <button className={`btn btn-sm ${!start && !end ? 'btn-primary' : 'btn-ghost'}`} onClick={clearDates}>Tout</button>
            <button className={`btn btn-sm ${start ? '' : ''} btn-ghost`} onClick={setThisWeek}>Cette semaine</button>
            <button className="btn btn-ghost btn-sm" onClick={setThisMonth}>Ce mois</button>
            <button className="btn btn-ghost btn-sm" onClick={setThisYear}>Cette année</button>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="text-sm text-muted">Du</label>
            <input className="form-input" type="date" value={start} max={end || undefined}
              onChange={e => { const v = e.target.value; setStart(v); if (end && v > end) setEnd(v); }}
              style={{ width: 150, padding: '4px 8px' }} />
            <label className="text-sm text-muted">Au</label>
            <input className="form-input" type="date" value={end} min={start || undefined}
              onChange={e => { const v = e.target.value; setEnd(v); if (start && v < start) setStart(v); }}
              style={{ width: 150, padding: '4px 8px' }} />
            {(start || end) && (
              <button className="btn btn-ghost btn-sm" onClick={clearDates} title="Effacer le filtre">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Résumé filtre SDR ── */}
      {isAdmin && search && (
        <div className="card mb-16" style={{ padding: '10px 16px', background: 'var(--primary-light)', borderLeft: '3px solid var(--primary)' }}>
          <div className="flex items-center gap-16 flex-wrap">
            <span className="text-sm" style={{ fontWeight: 600 }}>👤 {search}</span>
            <span className="text-sm"><strong style={{ color: 'var(--primary)' }}>{filteredPris}</strong> pris</span>
            <span className="text-sm"><strong style={{ color: 'var(--success)' }}>{filteredDone}</strong> done</span>
            <span className="text-sm text-muted">{filteredBySdr.length} total</span>
            {(start || end) && (
              <span className="text-sm text-muted">· {start || '…'} → {end || '…'}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Vue par SDR ── */}
      {isAdmin && viewMode === 'sdr' && (
        sdrGroups.length === 0
          ? <div className="card"><div className="empty-state"><div className="empty-state-icon">👤</div><div className="empty-state-text">Aucun SDR trouvé.</div></div></div>
          : sdrGroups.map(g => {
            const visibleRdvs = applyStatus(g.rdvs);
            const pris = g.rdvs.filter(r => r.crm_url_pris).length;
            const done = g.rdvs.filter(r => r.status === 'done').length;
            const isOpen = openGroups[g.sdrId] !== false;
            return (
              <div key={g.sdrId} className="synthesis-group">
                {/* En-tête SDR cliquable */}
                <div
                  className="synthesis-group-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleGroup(g.sdrId)}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 12 }}>{isOpen ? '▼' : '▶'}</span>
                  <span className="marche-dot" style={{ background: g.marcheColor, width: 10, height: 10 }} />
                  <span className="synthesis-group-name">{g.sdrName}</span>
                  <span className="text-muted text-sm">{g.marcheName}</span>
                  <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>
                    <strong style={{ color: 'var(--primary)' }}>{pris}</strong> pris
                    {' · '}
                    <strong style={{ color: 'var(--success)' }}>{done}</strong> done
                    {' · '}{g.rdvs.length} total
                  </span>
                </div>

                {/* Table RDVs */}
                {isOpen && (
                  <div className="synthesis-table-wrap">
                    {visibleRdvs.length === 0
                      ? <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>Aucun RDV pour ce filtre.</div>
                      : <table>
                          <TableHead showSdr={false} allSelected={visibleRdvs.length > 0 && visibleRdvs.every(r => selected.has(r.id))} onSelectAll={c => selectAll(visibleRdvs, c)} />
                          <tbody>
                            <RdvRows rdvs={visibleRdvs} showSdr={false} onMarkDone={setModalRdv} onNoShow={handleNoShow} isAdmin={isAdmin} selected={selected} onToggle={toggleSelect} />
                          </tbody>
                        </table>
                    }
                  </div>
                )}
              </div>
            );
          })
      )}

      {/* ── Vue liste ── */}
      {(!isAdmin || viewMode === 'list') && (
        <div className="card">
          {applyStatus(filteredBySdr).length === 0
            ? <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-text">Aucun RDV trouvé.</div></div>
            : <div className="table-wrap">
                <table>
                  <TableHead showSdr={isAdmin} allSelected={applyStatus(filteredBySdr).length > 0 && applyStatus(filteredBySdr).every(r => selected.has(r.id))} onSelectAll={c => selectAll(applyStatus(filteredBySdr), c)} />
                  <tbody>
                    <RdvRows rdvs={applyStatus(filteredBySdr)} showSdr={isAdmin} onMarkDone={setModalRdv} onNoShow={handleNoShow} isAdmin={isAdmin} selected={selected} onToggle={toggleSelect} />
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {modalRdv && <MarkDoneModal rdv={modalRdv} onClose={() => setModalRdv(null)} onSaved={handleSaved} />}
      {noShowRdv && <NoShowModal rdv={noShowRdv} onClose={() => setNoShowRdv(null)} onSaved={handleNoShowSaved} />}
      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}

      {/* ── Barre d'actions multi-sélection ── */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', borderTop: '2px solid var(--primary)',
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <button
            className="btn btn-sm btn-ghost"
            disabled={bulkLoading}
            onClick={handleBulkArchive}
            title="Archiver les RDVs sélectionnés"
          >
            {bulkLoading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : '🗄️ Archiver'}
          </button>
          {isAdmin && (
            <button
              className="btn btn-danger btn-sm"
              disabled={bulkLoading}
              onClick={handleBulkDelete}
              title="Supprimer définitivement"
            >
              🗑️ Supprimer
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={clearSelection}
          >
            ✕ Désélectionner
          </button>
        </div>
      )}
      <style>{`
        @keyframes spinGlow {
          0%   { box-shadow: 0 3px 10px rgba(239,68,68,.7),  inset 0 0 0 2px #ef4444; }
          25%  { box-shadow: 8px 0 10px rgba(239,68,68,.7),  inset 0 0 0 2px #ef4444; }
          50%  { box-shadow: 0 -3px 10px rgba(239,68,68,.7), inset 0 0 0 2px #ef4444; }
          75%  { box-shadow: -8px 0 10px rgba(239,68,68,.7), inset 0 0 0 2px #ef4444; }
          100% { box-shadow: 0 3px 10px rgba(239,68,68,.7),  inset 0 0 0 2px #ef4444; }
        }
        .rdv-overdue {
          border-radius: 8px;
          animation: spinGlow 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
