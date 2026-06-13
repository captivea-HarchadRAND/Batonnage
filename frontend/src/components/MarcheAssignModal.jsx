import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function MarcheAssignModal({ marche, onClose }) {
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(null); // 'available' | 'assigned'

  useEffect(() => {
    api.getUsers()
      .then(data => setUsers(data.filter(u => u.status !== 'disabled')))
      .finally(() => setLoading(false));
  }, []);

  const assigned  = users.filter(u => Number(u.marche_id) === Number(marche.id));
  const available = users.filter(u => Number(u.marche_id) !== Number(marche.id));

  const assign = async (user) => {
    if (saving) return;
    setSaving(user.id);
    try {
      await api.updateUser(user.id, { marche_id: marche.id });
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, marche_id: marche.id, marche_name: marche.name, marche_color: marche.color }
        : u));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  };

  const unassign = async (user) => {
    if (saving) return;
    setSaving(user.id);
    try {
      await api.updateUser(user.id, { marche_id: null });
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, marche_id: null, marche_name: null, marche_color: null }
        : u));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  };

  // ── Drag handlers (dataTransfer = reliable, no React state for dragging) ──
  const onDragStart = (e, userId, from) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ userId, from }));
  };

  const onDragOver = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== side) setDragOver(side);
  };

  const onDragLeave = (e) => {
    // Only clear if leaving the panel entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  };

  const onDrop = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    try {
      const { userId, from } = JSON.parse(e.dataTransfer.getData('text/plain'));
      const user = users.find(u => u.id === userId);
      if (!user) return;
      if (target === 'assigned'  && from === 'available') assign(user);
      if (target === 'available' && from === 'assigned')  unassign(user);
    } catch {}
  };

  const panelCls = (side) => {
    const base = { borderRadius: 8, maxHeight: 380, overflowY: 'auto', transition: 'background .15s, box-shadow .15s' };
    if (side === 'assigned') {
      return {
        ...base,
        border: `1px solid ${dragOver === 'assigned' ? marche.color : marche.color + '44'}`,
        background: dragOver === 'assigned' ? marche.color + '22' : marche.color + '08',
        boxShadow: dragOver === 'assigned' ? `0 0 0 2px ${marche.color}44` : 'none',
      };
    }
    return {
      ...base,
      border: `1px solid ${dragOver === 'available' ? 'var(--primary)' : 'var(--border)'}`,
      background: dragOver === 'available' ? 'var(--primary-light)' : 'transparent',
      boxShadow: dragOver === 'available' ? '0 0 0 2px var(--primary-light)' : 'none',
    };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 660, width: '92vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-8">
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: marche.color, flexShrink: 0 }} />
            <div className="modal-title">{marche.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 1fr', paddingTop: 4, alignItems: 'start' }}>

            {/* ── Gauche : disponibles ── */}
            <div>
              <div className="marche-assign-col-label">Utilisateurs · {available.length}</div>
              <div style={panelCls('available')}
                onDragOver={e => onDragOver(e, 'available')}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, 'available')}>
                {available.length === 0 ? (
                  <div className="text-muted text-sm" style={{ padding: '24px 16px', textAlign: 'center' }}>
                    {dragOver === 'available' ? '← Déposer pour retirer' : 'Tous les utilisateurs sont assignés'}
                  </div>
                ) : available.map(u => (
                  <div key={u.id} className="marche-assign-row"
                    draggable="true"
                    onDragStart={e => onDragStart(e, u.id, 'available')}>
                    <span className="marche-assign-drag-handle">⠿</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      {u.marche_name && (
                        <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: u.marche_color, flexShrink: 0 }} />
                          {u.marche_name}
                        </div>
                      )}
                    </div>
                    <button className="marche-assign-arrow-btn" disabled={!!saving}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); assign(u); }}>
                      {saving === u.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '→'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Centre ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 34, color: 'var(--text-dim)', fontSize: 18, userSelect: 'none' }}>
              ⇄
            </div>

            {/* ── Droite : assignés ── */}
            <div>
              <div className="marche-assign-col-label" style={{ color: marche.color }}>{marche.name} · {assigned.length}</div>
              <div style={panelCls('assigned')}
                onDragOver={e => onDragOver(e, 'assigned')}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, 'assigned')}>
                {assigned.length === 0 ? (
                  <div className="text-muted text-sm" style={{ padding: '24px 16px', textAlign: 'center' }}>
                    {dragOver === 'assigned' ? '→ Déposer pour assigner' : 'Aucun utilisateur assigné'}
                  </div>
                ) : assigned.map(u => (
                  <div key={u.id} className="marche-assign-row"
                    draggable="true"
                    onDragStart={e => onDragStart(e, u.id, 'assigned')}>
                    <button className="marche-assign-arrow-btn" disabled={!!saving}
                      style={{ color: 'var(--danger)' }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); unassign(u); }}>
                      {saving === u.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '←'}
                    </button>
                    <div style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <span className="marche-assign-drag-handle">⠿</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
