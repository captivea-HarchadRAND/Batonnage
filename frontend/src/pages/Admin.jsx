import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

function PasswordStrength({ password }) {
  const checks = [
    { label: '12 caractères min.', ok: password.length >= 12 },
    { label: 'Majuscule (A-Z)',    ok: /[A-Z]/.test(password) },
    { label: 'Minuscule (a-z)',    ok: /[a-z]/.test(password) },
    { label: 'Chiffre (0-9)',      ok: /[0-9]/.test(password) },
    { label: 'Caractère spécial', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#ef4444','#ef4444','#f59e0b','#f59e0b','#22c55e'];
  const labels = ['Très faible','Faible','Moyen','Bon','Fort'];
  if (!password) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? colors[score-1] : 'var(--border)', transition: 'background .3s' }} />
        ))}
        <span style={{ fontSize: 11, fontWeight: 700, color: colors[score-1] || 'var(--text-muted)', marginLeft: 6, whiteSpace: 'nowrap' }}>
          {labels[score-1] || ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {checks.map(c => (
          <span key={c.label} style={{ fontSize: 11, color: c.ok ? '#22c55e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }) {
  return (
    <label className={`chk${checked ? ' checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="chk-box">
        <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1.5,5 4,7.5 8.5,2.5" />
        </svg>
      </span>
    </label>
  );
}

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

function UserModal({ u, marches, me, onClose, onSaved, onDelete }) {
  // Le modal ne sert qu'à choisir le marché PAR DÉFAUT parmi les marchés affectés.
  // Les affectations elles-mêmes se gèrent dans l'onglet Marchés.
  const assignedMarches = marches.filter(m => u.marche_ids?.includes(m.id));
  const canChooseDefault = assignedMarches.length > 1; // mono-marché → aucun choix
  const defaultMarche = assignedMarches.some(m => m.id === u.marche_id)
    ? u.marche_id
    : (assignedMarches[0]?.id || '');

  const [form, setForm] = useState({
    name: u.name,
    email: u.email,
    role: u.role,
    marche_id: defaultMarche,
    objectif: u.objectif || 8,
  });
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [resetPwForm, setResetPwForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      await api.updateUser(u.id, { name: form.name, email: form.email, role: form.role, marche_id: form.marche_id || null });
      if (form.role === 'sdr') await api.updateObjectif(u.id, parseInt(form.objectif));
      onSaved({ ...u, ...form });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const updated = await api.updateUser(u.id, { status: 'disabled' });
      onSaved({ ...u, ...updated });
    } catch (err) { setError(err.message); setConfirmAction(null); }
    finally { setLoading(false); }
  };

  const handleReactivate = async () => {
    const restoreStatus = u.previous_status || 'active';
    setLoading(true);
    try {
      const updated = await api.updateUser(u.id, { status: restoreStatus });
      onSaved({ ...u, ...updated });
    } catch (err) { setError(err.message); setConfirmAction(null); }
    finally { setLoading(false); }
  };

  const restoreLabel = (u.previous_status || 'active') === 'pending' ? 'En attente' : 'Actif';

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="flex items-center gap-8">
              <div className="modal-title">{u.name}</div>
              <span className={`badge ${u.status === 'active' ? 'badge-green' : u.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                {u.status === 'active' ? '● Actif' : u.status === 'pending' ? '⏳ En attente' : '○ Désactivé'}
              </span>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          {error && <div className="alert alert-error mb-12">{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" value={form.name} onChange={set('name')} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={set('email')} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  <option value="sdr">SDR</option>
                  <option value="manager">Manager</option>
                  {me?.role === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Marché par défaut</label>
                <select className="form-select" value={form.marche_id} onChange={set('marche_id')} disabled={!canChooseDefault}>
                  {assignedMarches.length === 0 && <option value="">Aucun marché affecté</option>}
                  {assignedMarches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                  {assignedMarches.length === 0
                    ? "Affectez d'abord un marché dans l'onglet Marchés."
                    : canChooseDefault
                      ? "Choix du marché principal parmi les marchés affectés."
                      : 'Mono-marché : aucun choix. Les affectations se gèrent dans l\'onglet Marchés.'}
                </div>
              </div>
            </div>
            {form.role === 'sdr' && (
              <div className="form-group">
                <label className="form-label">Objectif mensuel (RDV done)</label>
                <input className="form-input" type="number" min={0} value={form.objectif}
                  onChange={set('objectif')} style={{ width: 110 }} />
              </div>
            )}
          </div>

          {resetPwForm ? (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>🔑 Nouveau mot de passe</div>
              {resetSuccess && <div className="alert alert-success" style={{ marginBottom: 8 }}>Mot de passe réinitialisé !</div>}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" disabled={resetLoading} onClick={async () => {
                  setResetLoading(true); setError('');
                  try {
                    await api.resetUserPassword(u.id, newPassword);
                    setNewPassword('');
                    setResetPwForm(false);
                    setResetSuccess(false);
                  } catch (err) { setError(err.message); }
                  finally { setResetLoading(false); }
                }}>
                  {resetLoading ? <span className="spinner" /> : 'Valider'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setResetPwForm(false); setNewPassword(''); setResetSuccess(false); }}>
                  Annuler
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, color: 'var(--warning)' }}
              onClick={() => setResetPwForm(true)}>
              🔑 Réinitialiser le mot de passe
            </button>
          )}

          <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {confirmAction === 'disable' && (
        <ConfirmModal icon="○" title="Désactiver le compte"
          message={`${u.name} n'aura plus accès à l'application.`}
          confirmLabel={loading ? '...' : 'Désactiver'} confirmClass="btn-danger"
          onConfirm={handleDisable} onClose={() => setConfirmAction(null)} />
      )}
      {confirmAction === 'reactivate' && (
        <ConfirmModal icon="↩" title="Réactiver le compte"
          message={`${u.name} sera réactivé avec le statut "${restoreLabel}".`}
          confirmLabel={loading ? '...' : 'Réactiver'} confirmClass="btn-primary"
          onConfirm={handleReactivate} onClose={() => setConfirmAction(null)} />
      )}
      {confirmAction === 'delete' && (
        <ConfirmModal icon="🗑️" title="Suppression définitive"
          message={`Supprimer définitivement ${u.name} ? Cette action est irréversible.`}
          confirmLabel="Supprimer" confirmClass="btn-danger"
          onConfirm={() => onDelete(u.id)} onClose={() => setConfirmAction(null)} />
      )}
    </>
  );
}

function UsersTab({ marches }) {
  const { user: me } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'sdr', marche_id: '', password: '' });
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  // const [resendingId, setResendingId] = useState(null);
  // const [resendMsg, setResendMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDisableConfirm, setBulkDisableConfirm] = useState(false);
  const [bulkReactivateConfirm, setBulkReactivateConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    api.getUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setSelected(new Set()); setBulkConfirm(false); setBulkDisableConfirm(false); setBulkReactivateConfirm(false); setError(''); }, [statusFilter]);

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const sq = searchUser.toLowerCase();
  const filteredUsers = users.filter(u =>
    (statusFilter === 'all' || u.status === statusFilter) &&
    (!sq || u.name.toLowerCase().includes(sq) || u.email.toLowerCase().includes(sq))
  );
  const selectableUsers = filteredUsers.filter(u => u.id !== me?.id);
  const showCheckboxes = ['active', 'pending', 'disabled'].includes(statusFilter);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selected.has(u.id));

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = (e) => {
    e.stopPropagation();
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableUsers.map(u => u.id)));
  };

  const handleBulkDisable = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => api.updateUser(id, { status: 'disabled' })));
      setUsers(prev => prev.map(u => selected.has(u.id) ? { ...u, status: 'disabled' } : u));
      setSelected(new Set());
      setBulkDisableConfirm(false);
    } finally { setBulkLoading(false); }
  };

  const handleBulkReactivate = async () => {
    setBulkLoading(true);
    try {
      const updates = await Promise.all([...selected].map(id => {
        const u = users.find(x => x.id === id);
        return api.updateUser(id, { status: u?.previous_status || 'active' });
      }));
      setUsers(prev => prev.map(u => {
        if (!selected.has(u.id)) return u;
        const updated = updates.find(r => r?.id === u.id);
        return updated ? { ...u, ...updated } : u;
      }));
      setSelected(new Set());
      setBulkReactivateConfirm(false);
    } finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => api.deleteUser(id)));
      setUsers(prev => prev.filter(u => !selected.has(u.id)));
      setSelected(new Set());
      setBulkConfirm(false);
    } finally { setBulkLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user, invite_token } = await api.createUser(form);
      setUsers(prev => [...prev, user]);
      if (invite_token) setInviteLink(`${window.location.origin}/invite/${invite_token}`);
      setShowForm(false);
      setForm({ name: '', email: '', role: 'sdr', marche_id: '', password: '' });
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div style={{ padding: 24 }}><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-filter-bar flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
        <div className="flex gap-8 flex-wrap">
          {[
            { key: 'all', label: 'Tous', count: users.length },
            { key: 'active', label: '● Actif', count: users.filter(u => u.status === 'active').length },
            { key: 'pending', label: '⏳ En attente', count: users.filter(u => u.status === 'pending').length },
            { key: 'disabled', label: '○ Désactivé', count: users.filter(u => u.status === 'disabled').length },
          ].map(f => (
            <button key={f.key}
              className={`btn btn-sm ${statusFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(f.key)}>
              {f.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-8 items-center">
          <input
            className="form-input"
            placeholder="🔍 Rechercher…"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            style={{ width: 200, padding: '5px 10px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Annuler' : '+ Ajouter'}
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Lien d'invitation : <a href={inviteLink} target="_blank" rel="noopener noreferrer">{inviteLink}</a>
          </span>
          <button className="btn btn-sm" style={{ flexShrink: 0 }}
            onClick={() => { navigator.clipboard.writeText(inviteLink); }}>
            Copier
          </button>
        </div>
      )}
      {/* resendMsg — désactivé (email)
      {resendMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>{resendMsg}</div>
      )}
      */}

      {selected.size > 0 && (
        <div className="flex items-center gap-12 mb-12" style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 16px',
        }}>
          <span className="text-sm" style={{ fontWeight: 600 }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <span style={{ flex: 1 }} />
          {statusFilter === 'disabled' ? (
            <>
              <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}
                onClick={() => setBulkReactivateConfirm(true)}>
                ↩ Réactiver la sélection
              </button>
              <button className="btn btn-sm" style={{ color: 'var(--danger)', border: '1px solid var(--danger)' }}
                onClick={() => setBulkConfirm(true)}>
                🗑️ Supprimer définitivement
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--warning)' }}
              onClick={() => setBulkDisableConfirm(true)}>
              ○ Désactiver la sélection
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>✕ Désélectionner</button>
        </div>
      )}

      {showForm && (
        <div className="card mb-16">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input className="form-input" value={form.name} onChange={set('name')} required placeholder="Prénom NOM" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={set('email')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  <option value="sdr">SDR</option>
                  <option value="manager">Manager</option>
                  {me?.role === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Marché</label>
                <select className="form-select" value={form.marche_id} onChange={set('marche_id')}>
                  <option value="">— Aucun —</option>
                  {marches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe (laisser vide pour invitation)</label>
              <input className="form-input" type="password" value={form.password} onChange={set('password')} placeholder="Optionnel" />
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary btn-sm">Créer</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap admin-table-scroll" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              {showCheckboxes && (
                <th style={{ width: 40 }} onClick={toggleAll}>
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                </th>
              )}
              <th>Nom</th>
              <th>Rôle</th>
              <th>Marché</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(u)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                {showCheckboxes && (
                  <td onClick={e => e.stopPropagation()}>
                    {u.id !== me?.id && (
                      <Checkbox checked={selected.has(u.id)}
                        onChange={e => toggleSelect(u.id, e)} />
                    )}
                  </td>
                )}
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="text-muted text-sm">{u.email}</div>
                </td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'manager' ? 'badge-yellow' : 'badge-blue'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td>
                  {u.marche_ids?.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {u.marche_ids.map(mid => {
                        const m = marches.find(x => x.id === mid);
                        if (!m) return null;
                        const isDefault = mid === u.marche_id;
                        return (
                          <span key={mid} title={isDefault ? 'Marché par défaut' : undefined}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: m.color, background: m.color + '18', borderRadius: 10, padding: '2px 8px', fontWeight: 600, border: `1px solid ${isDefault ? m.color : 'transparent'}` }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                            {m.name}
                            {isDefault && <span style={{ fontSize: 10 }}>★</span>}
                          </span>
                        );
                      })}
                    </div>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${u.status === 'active' ? 'badge-green' : u.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                    {u.status === 'active' ? '● Actif' : u.status === 'pending' ? '⏳ En attente' : '○ Désactivé'}
                  </span>
                  {/* bouton Renvoyer désactivé (email) */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bulkReactivateConfirm && (
        <ConfirmModal
          icon="↩"
          title="Réactiver les utilisateurs"
          message={`Réactiver ${selected.size} utilisateur${selected.size > 1 ? 's' : ''} dans leur état précédent (Actif ou En attente) ?`}
          confirmLabel={bulkLoading ? '...' : 'Réactiver'}
          confirmClass="btn-primary"
          onConfirm={handleBulkReactivate}
          onClose={() => setBulkReactivateConfirm(false)}
        />
      )}

      {bulkDisableConfirm && (
        <ConfirmModal
          icon="○"
          title="Désactiver les utilisateurs"
          message={`Vous êtes sur le point de désactiver ${selected.size} utilisateur${selected.size > 1 ? 's' : ''}. Ils n'auront plus accès à l'application.`}
          confirmLabel={bulkLoading ? '...' : 'Désactiver'}
          confirmClass="btn-danger"
          onConfirm={handleBulkDisable}
          onClose={() => setBulkDisableConfirm(false)}
        />
      )}

      {bulkConfirm && (
        <ConfirmModal
          icon="🗑️"
          title="Suppression définitive"
          message={`Vous êtes sur le point de supprimer définitivement ${selected.size} utilisateur${selected.size > 1 ? 's' : ''}. Cette action est irréversible.`}
          confirmLabel={bulkLoading ? '...' : 'Supprimer'}
          confirmClass="btn-danger"
          onConfirm={handleBulkDelete}
          onClose={() => setBulkConfirm(false)}
        />
      )}

      {selectedUser && (
        <UserModal
          u={selectedUser}
          marches={marches}
          me={me}
          onClose={() => setSelectedUser(null)}
          onSaved={(updated) => {
            setUsers(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
            setSelectedUser(null);
          }}
          onDelete={async (id) => {
            await api.deleteUser(id);
            setUsers(prev => prev.filter(x => x.id !== id));
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

function MarchesTab({ refreshMarches }) {
  const [marches, setMarches] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', color: '#3b82f6' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    api.getAdminMarches().then(setMarches);
    api.getUsers().then(setUsers);
  }, []);

  const active   = marches.filter(m => !m.archived);
  const archived = marches.filter(m => m.archived);

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const m = await api.createMarche(form);
      setMarches(prev => [...prev, m]);
      setForm({ name: '', code: '', color: '#3b82f6' });
      setShowForm(false);
      refreshMarches();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce marché définitivement ? Cette action est irréversible.')) return;
    try {
      await api.deleteMarche(id);
      setMarches(prev => prev.filter(m => m.id !== id));
      refreshMarches();
    } catch (err) { alert(err.message); }
  };

  const handleArchive = async () => {
    if (!archiveConfirm) return;
    try {
      await api.archiveMarche(archiveConfirm.id);
      setMarches(prev => prev.map(m => m.id === archiveConfirm.id ? { ...m, archived: 1 } : m));
      setUsers(prev => prev.map(u => u.marche_id === archiveConfirm.id ? { ...u, marche_id: null } : u));
      setArchiveConfirm(null);
      refreshMarches();
    } catch (err) { alert(err.message); setArchiveConfirm(null); }
  };

  const handleUnarchive = async (id) => {
    try {
      await api.unarchiveMarche(id);
      setMarches(prev => prev.map(m => m.id === id ? { ...m, archived: 0 } : m));
      refreshMarches();
    } catch (err) { alert(err.message); }
  };

  const impacted = archiveConfirm
    ? users.filter(u => u.marche_id === archiveConfirm.id && u.status !== 'disabled')
    : [];

  return (
    <div>
      {archiveConfirm && (
        <ConfirmModal
          title={`Archiver « ${archiveConfirm.name} » ?`}
          message={
            impacted.length > 0
              ? `${impacted.length} utilisateur(s) seront désassignés : ${impacted.map(u => u.name).join(', ')}. Leurs RDVs historiques restent attachés à ce marché.`
              : `Aucun utilisateur assigné. Les RDVs historiques restent dans la base.`
          }
          confirmLabel="Archiver"
          confirmClass="btn-warning"
          icon="📦"
          onConfirm={handleArchive}
          onClose={() => setArchiveConfirm(null)}
        />
      )}

      <div className="flex items-center justify-between mb-16">
        <span className="text-sm text-muted">{active.length} marché(s) actif(s)</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-16">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input className="form-input" value={form.name} onChange={set('name')} required placeholder="France" />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" value={form.code} onChange={set('code')} required placeholder="FR" style={{ width: 80 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Couleur</label>
              <input type="color" value={form.color} onChange={set('color')} style={{ width: 48, height: 38, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginBottom: 1 }}>Créer</button>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Couleur</th><th>Nom</th><th>Code</th><th>Utilisateurs</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {active.map(m => {
              const count = users.filter(u => u.marche_id === m.id && u.status !== 'disabled').length;
              return (
                <tr key={m.id}>
                  <td><span className="marche-dot" style={{ background: m.color, width: 16, height: 16, borderRadius: 4 }} /></td>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td><span className="badge badge-gray">{m.code}</span></td>
                  <td><span className="text-muted text-sm">{count} SDR{count !== 1 ? 's' : ''}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--warning)' }} onClick={() => setArchiveConfirm(m)}>📦 Archiver</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Supprimer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, gap: 6 }} onClick={() => setShowArchived(v => !v)}>
            {showArchived ? '▼' : '▶'} Archivés ({archived.length})
          </button>
          {showArchived && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Couleur</th><th>Nom</th><th>Code</th><th></th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {archived.map(m => (
                    <tr key={m.id} style={{ opacity: 0.55 }}>
                      <td><span className="marche-dot" style={{ background: m.color, width: 16, height: 16, borderRadius: 4 }} /></td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><span className="badge badge-gray">{m.code}</span></td>
                      <td><span className="badge" style={{ background: 'var(--surface3)', color: 'var(--text-muted)', fontSize: 10 }}>archivé</span></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleUnarchive(m.id)}>↩ Réactiver</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignTab({ marches }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selLeft, setSelLeft] = useState(new Set());
  const [selRight, setSelRight] = useState(new Set());
  const [searchMarche, setSearchMarche] = useState('');
  const [searchUser, setSearchUser] = useState('');
  // Staging — changes not yet saved to server
  const [pendingAdd, setPendingAdd] = useState([]);    // IDs staged to join the market
  const [pendingRem, setPendingRem] = useState([]);    // IDs staged to leave the market

  const loadUsers = () => api.getUsers().then(data => setUsers(data.filter(u => u.status !== 'disabled')));

  useEffect(() => { loadUsers().finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!selectedId && marches.length) setSelectedId(marches[0].id); }, [marches]);

  const hasPending = pendingAdd.length > 0 || pendingRem.length > 0;

  const switchMarche = (id) => {
    setSelectedId(id);
    setSelLeft(new Set()); setSelRight(new Set());
    setPendingAdd([]); setPendingRem([]);
  };

  const marche = marches.find(m => m.id === selectedId);
  const q = searchUser.toLowerCase();

  // Visual columns incorporate pending moves (no API call yet)
  const rightIds = new Set([
    ...users.filter(u => u.marche_ids?.includes(selectedId)).map(u => u.id),
    ...pendingAdd,
  ].filter(id => !pendingRem.includes(id)));

  const filterQ = u => !q || u.name.toLowerCase().includes(q);
  const assigned  = users.filter(u => rightIds.has(u.id) && filterQ(u));
  const available = users.filter(u => !rightIds.has(u.id) && filterQ(u));

  const visibleMarches = searchMarche
    ? marches.filter(m => m.name.toLowerCase().includes(searchMarche.toLowerCase()))
    : marches;

  const toggleLeft = (id, e) => {
    setSelRight(new Set());
    setSelLeft(prev => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) { next.has(id) ? next.delete(id) : next.add(id); }
      else { if (next.size === 1 && next.has(id)) next.clear(); else { next.clear(); next.add(id); } }
      return next;
    });
  };
  const toggleRight = (id, e) => {
    setSelLeft(new Set());
    setSelRight(prev => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) { next.has(id) ? next.delete(id) : next.add(id); }
      else { if (next.size === 1 && next.has(id)) next.clear(); else { next.clear(); next.add(id); } }
      return next;
    });
  };

  // Stage moves (no API call)
  const stageAdd = (ids) => {
    if (!marche || !ids.length) return;
    setPendingAdd(prev => [...prev, ...ids.filter(id => !prev.includes(id))]);
    setPendingRem(prev => prev.filter(id => !ids.includes(id)));
    setSelLeft(new Set());
  };
  const stageRem = (ids) => {
    if (!ids.length) return;
    setPendingRem(prev => [...prev, ...ids.filter(id => !prev.includes(id))]);
    setPendingAdd(prev => prev.filter(id => !ids.includes(id)));
    setSelRight(new Set());
  };

  // Actually save to server
  const applyChanges = async () => {
    if (!hasPending || saving) return;
    setSaving(true);
    try {
      await Promise.all([
        ...pendingAdd.map(id => api.assignUserToMarche(id, selectedId)),
        ...pendingRem.map(id => api.unassignUserFromMarche(id, selectedId)),
      ]);
      await loadUsers();
      setPendingAdd([]); setPendingRem([]);
      setSelLeft(new Set()); setSelRight(new Set());
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const discardChanges = () => {
    setPendingAdd([]); setPendingRem([]);
    setSelLeft(new Set()); setSelRight(new Set());
  };

  const colHeader = (label, color, count, onSelectAll) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>
        {label} · {count}
      </span>
      {count > 0 && (
        <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
          onClick={onSelectAll}>Tout</button>
      )}
    </div>
  );

  if (loading) return <div style={{ padding: 24 }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Recherche marché */}
      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="🔍 Rechercher un marché…" value={searchMarche}
          onChange={e => setSearchMarche(e.target.value)}
          style={{ width: 220, marginBottom: 10, padding: '5px 10px' }} />
        <div className="flex gap-8 flex-wrap">
          {visibleMarches.map(m => (
            <button key={m.id}
              className={`btn btn-sm ${selectedId === m.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => switchMarche(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
              {m.name}
            </button>
          ))}
          {visibleMarches.length === 0 && <span className="text-muted text-sm">Aucun marché trouvé.</span>}
        </div>
      </div>

      {/* Recherche utilisateur */}
      <div style={{ marginBottom: 14 }}>
        <input className="form-input" placeholder="🔍 Rechercher un utilisateur…" value={searchUser}
          onChange={e => setSearchUser(e.target.value)}
          style={{ width: 280, padding: '5px 10px' }} />
      </div>

      {/* Barre Appliquer / Annuler — visible uniquement quand il y a des changements en attente */}
      {hasPending && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          background: 'var(--warning-light)', border: '1px solid var(--warning)',
          borderRadius: 8, padding: '10px 16px',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', flex: 1 }}>
            {pendingAdd.length > 0 && `+${pendingAdd.length} à ajouter`}
            {pendingAdd.length > 0 && pendingRem.length > 0 && '  ·  '}
            {pendingRem.length > 0 && `-${pendingRem.length} à retirer`}
            {' '} — modifications non sauvegardées
          </span>
          <button className="btn btn-ghost btn-sm" onClick={discardChanges}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={applyChanges} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✓ Appliquer'}
          </button>
        </div>
      )}

      {!marche ? (
        <div className="empty-state"><div className="empty-state-text">Aucun marché disponible.</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr', gap: 0, alignItems: 'start' }}>

          {/* Colonne gauche — disponibles */}
          <div>
            {colHeader('Utilisateurs', 'var(--text-muted)', available.length,
              () => { setSelLeft(new Set(available.map(u => u.id))); setSelRight(new Set()); })}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 520, overflowY: 'auto' }}>
              {available.length === 0 ? (
                <div className="text-muted text-sm" style={{ padding: '24px 16px', textAlign: 'center' }}>
                  Tous les utilisateurs sont dans ce marché
                </div>
              ) : available.map(u => {
                const isPendingRem = pendingRem.includes(u.id);
                const userMarches = marches.filter(m => u.marche_ids?.includes(m.id) && m.id !== selectedId);
                return (
                  <div key={u.id}
                    className={`assign-row${selLeft.has(u.id) ? ' assign-row--selected' : ''}`}
                    style={isPendingRem ? { background: '#ef444408', borderLeft: '3px solid #ef4444' } : {}}
                    onClick={e => toggleLeft(u.id, e)}
                    onDoubleClick={() => stageAdd([u.id])}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                        {isPendingRem && <span style={{ fontSize: 10, color: '#ef4444', background: '#ef444418', borderRadius: 6, padding: '1px 5px', flexShrink: 0 }}>−</span>}
                      </div>
                      {userMarches.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          {userMarches.map(m => (
                            <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: m.color, background: m.color + '18', borderRadius: 10, padding: '1px 6px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                              {m.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Centre — flèches + annuler sélection */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 8px 0' }}>
            <button className="btn btn-sm btn-primary" style={{ width: 48, fontSize: 13 }}
              disabled={selLeft.size === 0} title="Déplacer vers ce marché"
              onClick={() => stageAdd([...selLeft])}>
              {`→${selLeft.size > 1 ? ` ${selLeft.size}` : ''}`}
            </button>
            <button className="btn btn-sm" style={{ width: 48, fontSize: 13, color: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={selRight.size === 0} title="Retirer de ce marché"
              onClick={() => stageRem([...selRight])}>
              {`${selRight.size > 1 ? `${selRight.size} ` : ''}←`}
            </button>
            {(selLeft.size > 0 || selRight.size > 0) && (
              <button className="btn btn-sm btn-ghost" style={{ width: 48, fontSize: 11, marginTop: 4 }}
                title="Désélectionner" onClick={() => { setSelLeft(new Set()); setSelRight(new Set()); }}>
                ✕
              </button>
            )}
          </div>

          {/* Colonne droite — assignés */}
          <div>
            {colHeader(marche.name, marche.color, assigned.length,
              () => { setSelRight(new Set(assigned.map(u => u.id))); setSelLeft(new Set()); })}
            <div style={{ border: `1px solid ${marche.color}44`, borderRadius: 8, maxHeight: 520, overflowY: 'auto', background: marche.color + '08' }}>
              {assigned.length === 0 ? (
                <div className="text-muted text-sm" style={{ padding: '24px 16px', textAlign: 'center' }}>
                  Aucun utilisateur assigné
                </div>
              ) : assigned.map(u => {
                const isPendingAdd = pendingAdd.includes(u.id);
                return (
                  <div key={u.id}
                    className={`assign-row${selRight.has(u.id) ? ' assign-row--selected' : ''}`}
                    style={{ borderBottomColor: marche.color + '22', ...(isPendingAdd ? { background: '#22c55e08', borderLeft: '3px solid #22c55e' } : {}) }}
                    onClick={e => toggleRight(u.id, e)}
                    onDoubleClick={() => stageRem([u.id])}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.name}</span>
                      {isPendingAdd && <span style={{ fontSize: 10, color: '#22c55e', background: '#22c55e18', borderRadius: 6, padding: '1px 5px', flexShrink: 0 }}>+</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
      <div className="text-muted text-sm" style={{ marginTop: 10, textAlign: 'center' }}>
        Clic pour sélectionner · Ctrl+clic multi-sélection · Double-clic pour déplacer · Cliquer "Appliquer" pour sauvegarder
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.getSettings().then(setSettings); }, []);

  const toggle = async (key, currentVal) => {
    const newVal = currentVal === '1' ? '0' : '1';
    setSaving(true);
    try {
      await api.updateSettings({ [key]: newVal });
      setSettings(s => ({ ...s, [key]: newVal }));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const Toggle = ({ label, desc, settingKey }) => {
    const on = settings[settingKey] === '1';
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div className="text-muted text-sm">{desc}</div>
        </div>
        <button
          onClick={() => toggle(settingKey, settings[settingKey])}
          disabled={saving}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: on ? 'var(--primary)' : 'var(--surface2)',
            position: 'relative', transition: 'background .2s', flexShrink: 0, marginLeft: 24,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: on ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', transition: 'left .2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>Paramètre sauvegardé.</div>}
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Classement</div>
      <Toggle
        settingKey="leaderboard_period_filter"
        label="Filtres Semaine & Année"
        desc="Affiche les boutons 'Cette semaine' et 'Cette année' sur le classement. Par défaut, seul le mois est disponible."
      />
    </div>
  );
}

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

function formatLabel(label, period) {
  if (period === 'week') return `S${label}`;
  if (period === 'month') return MONTH_LABELS[parseInt(label, 10) - 1] ?? label;
  return label;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PerformanceTab() {
  const now = new Date();
  const [period, setPeriod] = useState('month');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [sdrId, setSdrId] = useState('');
  const [sdrs, setSdrs] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    api.getUsers().then(users => setSdrs(users.filter(u => u.role === 'sdr' && u.status === 'active')));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { period, year };
    if (sdrId) params.sdr_id = sdrId;
    api.getPerformance(params)
      .then(rows => setData(rows.map(r => ({ ...r, label: formatLabel(r.label, period) }))))
      .finally(() => setLoading(false));
  }, [period, year, sdrId]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  const totalPris  = data.reduce((s, r) => s + (r.pris || 0), 0);
  const totalDone  = data.reduce((s, r) => s + (r.done || 0), 0);
  const totalNoShow = data.reduce((s, r) => s + (r.no_show || 0), 0);
  const convRate = totalPris > 0 ? Math.round((totalDone / totalPris) * 100) : 0;

  const selectedSdr = sdrs.find(s => s.id === sdrId);

  const ChartComponent = chartType === 'line' ? LineChart : BarChart;

  return (
    <div style={{ padding: 24 }}>
      {/* Filtres */}
      <div className="flex items-center gap-12 flex-wrap mb-24">
        {/* Période */}
        <div className="flex gap-8">
          {[
            { key: 'week', label: 'Semaine' },
            { key: 'month', label: 'Mois' },
            { key: 'year', label: 'Année' },
          ].map(p => (
            <button
              key={p.key}
              className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p.key)}
            >{p.label}</button>
          ))}
        </div>

        {/* Année (pas pour vue par année) */}
        {period !== 'year' && (
          <select
            className="form-input"
            style={{ width: 110, padding: '6px 10px' }}
            value={year}
            onChange={e => setYear(e.target.value)}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        {/* SDR selector */}
        <select
          className="form-input"
          style={{ width: 220, padding: '6px 10px' }}
          value={sdrId}
          onChange={e => setSdrId(e.target.value)}
        >
          <option value="">👥 Tous les SDRs</option>
          {sdrs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Chart type */}
        <div className="flex gap-8" style={{ marginLeft: 'auto' }}>
          <button
            className={`btn btn-sm ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setChartType('bar')}
            title="Barres"
          >▐▌</button>
          <button
            className={`btn btn-sm ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setChartType('line')}
            title="Courbes"
          >〜</button>
        </div>
      </div>

      {/* KPIs résumé */}
      <div className="flex gap-16 flex-wrap mb-24">
        {[
          { label: 'RDV Pris',  value: totalPris,   color: 'var(--primary)' },
          { label: 'RDV Done',  value: totalDone,   color: 'var(--success)' },
          { label: 'No Show',   value: totalNoShow, color: 'var(--warning)' },
          { label: 'Taux Done', value: `${convRate}%`, color: convRate >= 70 ? 'var(--success)' : convRate >= 40 ? 'var(--warning)' : 'var(--danger)' },
        ].map(k => (
          <div key={k.label} style={{
            flex: '1 1 140px', background: 'var(--surface2)',
            borderRadius: 12, padding: '16px 20px',
            borderLeft: `4px solid ${k.color}`,
          }}>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Titre contextuel */}
      <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-muted)' }}>
        {selectedSdr ? `📊 Performances de ${selectedSdr.name}` : '📊 Performances — tous SDRs'}
        {period !== 'year' && ` · ${year}`}
      </div>

      {/* Graphique */}
      <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '24px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
            <div className="spinner" />
          </div>
        ) : data.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, color: 'var(--text-muted)' }}>
            Aucune donnée pour cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ChartComponent data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16 }} />
              {chartType === 'bar' ? (
                <>
                  <Bar dataKey="pris"    name="RDV Pris" fill="#6366f1" radius={[4,4,0,0]} maxBarSize={48} />
                  <Bar dataKey="done"    name="RDV Done" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={48} />
                  <Bar dataKey="no_show" name="No Show"  fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={48} />
                </>
              ) : (
                <>
                  <Line dataKey="pris"    name="RDV Pris" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line dataKey="done"    name="RDV Done" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line dataKey="no_show" name="No Show"  stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </>
              )}
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tableau récap */}
      {data.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>{period === 'week' ? 'Semaine' : period === 'month' ? 'Mois' : 'Année'}</th>
                <th style={{ textAlign: 'right' }}>RDV Pris</th>
                <th style={{ textAlign: 'right' }}>RDV Done</th>
                <th style={{ textAlign: 'right' }}>No Show</th>
                <th style={{ textAlign: 'right' }}>Taux Done</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const rate = row.pris > 0 ? Math.round((row.done / row.pris) * 100) : 0;
                const color = rate >= 70 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 600 }}>{row.label}</td>
                    <td style={{ textAlign: 'right' }}>{row.pris}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>{row.done}</td>
                    <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{row.no_show}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color }}>{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoriesProblemeTab() {
  const [types, setTypes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ icon: '', label: '', color: '#6366f1' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api.getCallIssueTypes().then(setTypes).finally(() => setLoading(false));
  }, []);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.label.trim()) return setFormError('Le libellé est requis.');
    setSaving(true);
    try {
      const t = await api.createCallIssueType(form);
      setTypes(prev => [...prev, t]);
      setForm({ icon: '', label: '', color: '#6366f1' });
      setShowForm(false);
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteCallIssueType(confirmDelete.id);
      setTypes(prev => prev.filter(t => t.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ padding: 24 }}><div className="spinner" /></div>;

  return (
    <div>
      {confirmDelete && (
        <ConfirmModal
          icon={confirmDelete.icon}
          title={`Supprimer « ${confirmDelete.label} » ?`}
          message="Les problèmes déjà enregistrés avec ce type resteront dans la base mais ne pourront plus être filtrés par ce libellé."
          confirmLabel="Supprimer"
          confirmClass="btn-danger"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      <div className="flex items-center justify-between mb-16">
        <span className="text-sm text-muted">{types.length} catégorie{types.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-16">
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Icône (emoji)</label>
              <input className="form-input" value={form.icon} onChange={set('icon')}
                placeholder="📵" style={{ width: 72, textAlign: 'center', fontSize: 20 }} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Libellé *</label>
              <input className="form-input" value={form.label} onChange={set('label')}
                required placeholder="Ex: Numéro erroné" />
            </div>
            <div className="form-group">
              <label className="form-label">Couleur</label>
              <input type="color" value={form.color} onChange={set('color')}
                style={{ width: 48, height: 38, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ marginBottom: 1 }}>
              {saving ? <span className="spinner" /> : 'Créer'}
            </button>
          </form>
        </div>
      )}

      {types.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 120 }}>
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">Aucune catégorie définie.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Icône</th>
                <th>Libellé</th>
                <th>Couleur</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize: 22 }}>{t.icon}</td>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 10px', borderRadius: 20, fontSize: 12,
                      background: t.color + '22', color: t.color, border: `1px solid ${t.color}44`,
                    }}>
                      {t.icon} {t.label}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: t.color, display: 'inline-block' }} />
                      <span className="text-muted text-sm">{t.color}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t)}>
                      🗑️ Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Saisie manuelle de RDVs (modèle Appels) ─────────────────────────────────
function isoWeekOf(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const y = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  return { week: Math.ceil(((date - yearStart) / 86400000 + 1) / 7), year: y };
}

function weeksOfMonth(year, month) {
  const seen = new Set(); const result = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const { week, year: wy } = isoWeekOf(d);
    const k = `${wy}-${week}`;
    if (!seen.has(k)) { seen.add(k); result.push({ week, year: wy, label: `S${week}` }); }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function ManualRdvTab({ marches }) {
  const now = new Date();
  // logs key = `${sdrId}-${week}-${year}` → { crm_pris, crm_done, manual_pris, manual_done, marche_id, crm_marche_id }
  // Les inputs affichent le TOTAL (crm + manuel) ; le minimum est le count CRM (verrouillé)
  const [sdrs, setSdrs]       = useState([]);
  const [logs, setLogs]       = useState({});
  const [saving, setSaving]   = useState({});
  const [saveErr, setSaveErr] = useState({});
  const [loading, setLoading] = useState(true);
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth());
  const [search, setSearch]   = useState('');

  const weeks = weeksOfMonth(year, month);
  const curWeek = isoWeekOf(now);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getManualRdvs()])
      .then(([users, rows]) => {
        setSdrs(users.filter(u => u.role === 'sdr' && u.status === 'active'));
        const map = {};
        rows.forEach(r => {
          map[`${r.sdr_id}-${r.semaine}-${r.annee}`] = {
            crm_pris: r.crm_pris || 0, crm_done: r.crm_done || 0,
            manual_pris: r.manual_pris || 0, manual_done: r.manual_done || 0,
            marche_id: r.marche_id || null, crm_marche_id: r.crm_marche_id || null,
          };
        });
        setLogs(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const key = (sdrId, w) => `${sdrId}-${w.week}-${w.year}`;

  // val = total voulu (crm + manuel) ; clampé au minimum CRM
  const handleChange = (sdrId, w, field, val) => {
    const k = key(sdrId, w);
    const prev = logs[k] || { crm_pris: 0, crm_done: 0, manual_pris: 0, manual_done: 0 };
    const minVal = field === 'total_pris' ? (prev.crm_pris || 0) : (prev.crm_done || 0);
    const num = Math.max(minVal, parseInt(val, 10) || 0);
    const manualKey = field === 'total_pris' ? 'manual_pris' : 'manual_done';
    const crmKey    = field === 'total_pris' ? 'crm_pris'    : 'crm_done';
    setLogs(p => ({ ...p, [k]: { ...prev, [manualKey]: num - (prev[crmKey] || 0) } }));
    setSaveErr(p => ({ ...p, [k]: null }));
  };

  const handleBlur = async (sdr, w) => {
    const k = key(sdr.id, w);
    const entry = logs[k] || { crm_pris: 0, crm_done: 0, manual_pris: 0, manual_done: 0 };
    const marche_id = entry.marche_id || entry.crm_marche_id || sdr.marche_id;
    if (!marche_id) return;
    const totalPris = (entry.crm_pris || 0) + (entry.manual_pris || 0);
    const totalDone = (entry.crm_done || 0) + (entry.manual_done || 0);
    setSaving(p => ({ ...p, [k]: true }));
    try {
      await api.saveManualRdv(sdr.id, w.week, w.year, marche_id, totalPris, totalDone);
      setSaveErr(p => ({ ...p, [k]: null }));
    } catch (e) {
      setSaveErr(p => ({ ...p, [k]: e.message }));
    }
    setSaving(p => ({ ...p, [k]: false }));
  };

  const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = sdrs.filter(s => norm(s.name).includes(norm(search)));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div style={{ margin: '-20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', borderRadius: 0 }}>

        {/* ── Barre année + mois ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setYear(y => y - 1)}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: 'center' }}>{year}</span>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} disabled={year >= now.getFullYear()} onClick={() => setYear(y => y + 1)}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {MONTHS_FR.map((m, i) => {
              const isCur = i === now.getMonth() && year === now.getFullYear();
              const isSel = i === month;
              return (
                <button key={i} onClick={() => setMonth(i)} style={{
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

        {/* ── Barre recherche + légende ── */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: '0 1 280px' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input className="form-input" placeholder="Rechercher un SDR…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, height: 34 }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>● Pris</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>● Done</span>
            <span style={{ opacity: .6 }}>🔒 = RDVs CRM verrouillés</span>
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="table-wrap">
          <table className="admin-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>
                  SDR {filtered.length < sdrs.length && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({filtered.length})</span>}
                </th>
                {weeks.map(w => {
                  const isCur = w.week === curWeek.week && w.year === curWeek.year;
                  return (
                    <th key={`${w.week}-${w.year}`} style={{ textAlign: 'center', minWidth: 120 }}>
                      <span style={{ color: isCur ? 'var(--primary)' : undefined, fontWeight: isCur ? 700 : undefined }}>{w.label}</span>
                      {isCur && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--primary)' }}>cette sem.</div>}
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', minWidth: 90 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sdr => {
                let totPris = 0, totDone = 0;
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
                      const entry = logs[k] || { crm_pris: 0, crm_done: 0, manual_pris: 0, manual_done: 0 };
                      const totalPris = (entry.crm_pris || 0) + (entry.manual_pris || 0);
                      const totalDone = (entry.crm_done || 0) + (entry.manual_done || 0);
                      totPris += totalPris;
                      totDone += totalDone;
                      const isCur = w.week === curWeek.week && w.year === curWeek.year;
                      const isSaving = saving[k];
                      const err = saveErr[k];
                      const lockedPris = entry.crm_pris || 0;
                      const lockedDone = entry.crm_done || 0;
                      return (
                        <td key={k} style={{ textAlign: 'center', padding: '5px 6px', background: isCur ? 'rgba(59,130,246,0.04)' : undefined }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                            {/* Input Pris — affiche le total (crm + manuel) */}
                            <div style={{ position: 'relative' }}>
                              <input type="number" min={lockedPris} value={totalPris || ''}
                                placeholder={lockedPris > 0 ? String(lockedPris) : '—'}
                                onChange={e => handleChange(sdr.id, w, 'total_pris', e.target.value)}
                                onBlur={() => handleBlur(sdr, w)}
                                style={{
                                  width: 52, textAlign: 'center', fontSize: 13, fontWeight: 600,
                                  background: lockedPris > 0 ? 'rgba(59,130,246,0.06)' : 'transparent',
                                  border: `1.5px solid ${err ? 'var(--danger,#ef4444)' : isSaving ? 'var(--primary)' : lockedPris > 0 ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.3)'}`,
                                  borderRadius: 5, padding: '3px 4px', color: 'var(--primary)',
                                  outline: 'none', transition: 'border-color .15s',
                                }}
                              />
                              {lockedPris > 0 && (
                                <span title={`${lockedPris} RDV CRM verrouillés`} style={{ position: 'absolute', top: -6, right: -6, fontSize: 9, lineHeight: 1 }}>🔒</span>
                              )}
                            </div>
                            {/* Input Done */}
                            <div style={{ position: 'relative' }}>
                              <input type="number" min={lockedDone} value={totalDone || ''}
                                placeholder={lockedDone > 0 ? String(lockedDone) : '—'}
                                onChange={e => handleChange(sdr.id, w, 'total_done', e.target.value)}
                                onBlur={() => handleBlur(sdr, w)}
                                style={{
                                  width: 52, textAlign: 'center', fontSize: 13, fontWeight: 600,
                                  background: lockedDone > 0 ? 'rgba(34,197,94,0.06)' : 'transparent',
                                  border: `1.5px solid ${err ? 'var(--danger,#ef4444)' : isSaving ? 'var(--success)' : lockedDone > 0 ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.3)'}`,
                                  borderRadius: 5, padding: '3px 4px', color: 'var(--success)',
                                  outline: 'none', transition: 'border-color .15s',
                                }}
                              />
                              {lockedDone > 0 && (
                                <span title={`${lockedDone} RDV CRM verrouillés`} style={{ position: 'absolute', top: -6, right: -6, fontSize: 9, lineHeight: 1 }}>🔒</span>
                              )}
                            </div>
                          </div>
                          {isSaving && <div style={{ fontSize: 9, color: 'var(--primary)', marginTop: 2 }}>✓</div>}
                          {err && <div style={{ fontSize: 9, color: 'var(--danger,#ef4444)', marginTop: 2, maxWidth: 100, lineHeight: 1.2 }}>⚠ {err}</div>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: totPris > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{totPris || '—'}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: totDone > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{totDone || '—'}</div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={weeks.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                  {search ? `Aucun SDR trouvé pour "${search}".` : 'Aucun SDR actif.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [marches, setMarches] = useState([]);

  const refreshMarches = () => api.getMarches().then(setMarches);
  useEffect(() => { refreshMarches(); }, []);

  const TABS = [
    { id: 'users',      label: '👥 Utilisateurs' },
    { id: 'marches',    label: '🌍 Marchés' },
    { id: 'assign',     label: '🔗 Assignations' },
    { id: 'manual',     label: '✍️ Saisie RDV' },
    { id: 'categories', label: '📋 Catégories Problèmes' },
    { id: 'settings',   label: '⚙️ Paramètres' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">⚙️ Administration</div>
      </div>

      <div className="flex gap-8 mb-24 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'users'      && <UsersTab marches={marches} />}
        {tab === 'marches'    && <MarchesTab refreshMarches={refreshMarches} />}
        {tab === 'assign'     && <AssignTab marches={marches} />}
        {tab === 'manual'     && <ManualRdvTab marches={marches} />}
        {tab === 'categories' && <CategoriesProblemeTab />}
        {tab === 'settings'   && <SettingsTab />}
      </div>
    </div>
  );
}
