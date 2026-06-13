import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';

function today() {
  return new Date().toISOString().split('T')[0];
}


export default function SaisirRdv() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [marches, setMarches]       = useState([]);
  const [sdrs, setSdrs]             = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [monthCallTotal, setMonthCallTotal] = useState(null);

  // ── RDV form ──
  const [form, setForm] = useState({
    sdr_id: '', marche_id: '',
    crm_url_pris: '', date_pris: today(),
    date_prevue: '', crm_url_done: '', date_done: '', notes: '', nb_appels: '',
  });
  const [markDone, setMarkDone] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // ── Issue form ──
  const [issue, setIssue] = useState({
    sdr_id: '', marche_id: '', issue_type: '', date: today(), notes: '',
  });
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError]     = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');

  useEffect(() => {
    api.getMarches().then(list => {
      setMarches(list);
      if (user?.role === 'sdr' && list.length === 1) {
        setForm(f => ({ ...f, marche_id: list[0].id }));
        setIssue(f => ({ ...f, marche_id: list[0].id }));
      }
    });
    api.getCallIssueTypes().then(setIssueTypes);
    api.getMyCallLogs().then(logs => {
      const now = new Date();
      const m = now.getMonth(); const y = now.getFullYear();
      const total = logs.filter(l => {
        const d = new Date(Date.UTC(l.annee, 0, 1));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const monday = new Date(Date.UTC(d.getUTCFullYear(), 0, 1 + (l.semaine - 1) * 7));
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() || 7) + 1);
        return monday.getUTCMonth() === m && monday.getUTCFullYear() === y;
      }).reduce((s, l) => s + (l.nb_appels || 0), 0);
      setMonthCallTotal(total);
    }).catch(() => {});
    if (user?.role !== 'sdr') {
      api.getUsers().then(users => setSdrs(users.filter(u => u.role === 'sdr' && u.status === 'active')));
    }
  }, [user]);

  const set      = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const setIss   = (field) => (e) => setIssue(f => ({ ...f, [field]: e.target.value }));

  // ── Submit RDV ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.marche_id) return setError('Sélectionnez un marché.');
    if (!form.crm_url_pris && !form.crm_url_done) return setError('Au moins une URL CRM est requise.');
    setLoading(true);
    try {
      const payload = {
        ...form,
        sdr_id: user.role === 'sdr' ? user.id : (form.sdr_id || user.id),
        crm_url_done: markDone ? form.crm_url_done : '',
        date_done:    markDone ? form.date_done    : '',
      };
      await api.createRdv(payload);
      setSuccess('RDV enregistré avec succès !');
      setForm({ sdr_id: form.sdr_id, marche_id: form.marche_id, crm_url_pris: '', date_pris: today(), date_prevue: '', crm_url_done: '', date_done: '', notes: '', nb_appels: '' });
      setMarkDone(false);
      setTimeout(() => navigate('/mes-rdvs'), 1200);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Submit Issue ──
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setIssueError(''); setIssueSuccess('');
    if (!issue.issue_type) return setIssueError('Sélectionnez un type de problème.');
    setIssueLoading(true);
    try {
      await api.createCallIssue({
        ...issue,
        sdr_id: user.role === 'sdr' ? user.id : (issue.sdr_id || user.id),
      });
      setIssueSuccess('Problème signalé !');
      setIssue({ sdr_id: issue.sdr_id, marche_id: issue.marche_id, issue_type: '', date: today(), notes: '' });
      setTimeout(() => setIssueSuccess(''), 3000);
    } catch (err) { setIssueError(err.message); }
    finally { setIssueLoading(false); }
  };

  const SdrMarcheFields = ({ formState, setField }) => (
    user?.role === 'sdr' ? (
      <div className="flex gap-12">
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">SDR</label>
          <div className="form-input" style={{ background: 'var(--surface2)', cursor: 'default', color: 'var(--text)' }}>{user.name}</div>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Marché *</label>
          {marches.length <= 1 ? (
            <div className="form-input" style={{ background: 'var(--surface2)', cursor: 'default', color: 'var(--text)' }}>
              {marches[0]?.name || '—'}
            </div>
          ) : (
            <select className="form-select" value={formState.marche_id} onChange={setField('marche_id')} required>
              <option value="">— Sélectionner un marché —</option>
              {marches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
      </div>
    ) : (
      <>
        <div className="form-group">
          <label className="form-label">SDR</label>
          <select className="form-select" value={formState.sdr_id} onChange={setField('sdr_id')}>
            <option value="">— Sélectionner un SDR —</option>
            {sdrs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.marche_name || 'sans marché'})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Marché *</label>
          <select className="form-select" value={formState.marche_id} onChange={setField('marche_id')} required>
            <option value="">— Sélectionner un marché —</option>
            {marches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </>
    )
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">➕ Saisir</div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' }}>

        {/* ── Formulaire RDV ── */}
        <div className="card" style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>📅 Saisir un RDV</div>
          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <SdrMarcheFields formState={form} setField={set} />

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>RDV Pris</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">URL Odoo CRM (Pris)</label>
                  <input className="form-input" type="text" value={form.crm_url_pris} onChange={set('crm_url_pris')}
                    placeholder="https://www.captivea.com/odoo/crm/..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Pris le</label>
                  <input className="form-input" type="date" value={form.date_pris} onChange={set('date_pris')} />
                </div>
              </div>
              <div className="form-group mt-16">
                <label className="form-label">Prévu le (date du meeting)</label>
                <input className="form-input" type="date" value={form.date_prevue} onChange={set('date_prevue')} />
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Notes (optionnel)</label>
              <textarea className="form-textarea" value={form.notes} onChange={set('notes')} placeholder="Ex: 1 vente, prospect chaud..." style={{ height: '100%', minHeight: 80 }} />
            </div>

            <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Enregistrer le RDV'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Formulaire Problème d'appel ── */}
        <div className="card" style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>📞 Signaler un problème d'appel</div>
          {issueError   && <div className="alert alert-error">{issueError}</div>}
          {issueSuccess && <div className="alert alert-success">{issueSuccess}</div>}

          <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <SdrMarcheFields formState={issue} setField={setIss} />

            <div className="form-group">
              <label className="form-label">Type de problème *</label>
              <select className="form-select" value={issue.issue_type} onChange={setIss('issue_type')} required>
                <option value="">— Sélectionner un problème —</option>
                {issueTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date de l'appel</label>
              <input className="form-input" type="date" value={issue.date} onChange={setIss('date')} />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Notes (optionnel)</label>
              <textarea className="form-textarea" value={issue.notes} onChange={setIss('notes')} placeholder="Détails supplémentaires..." style={{ minHeight: 140, resize: 'vertical' }} />
            </div>

            <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setIssue({ sdr_id: issue.sdr_id, marche_id: issue.marche_id, issue_type: '', date: today(), notes: '' })}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={issueLoading}>
                {issueLoading ? <span className="spinner" /> : 'Signaler'}
              </button>
            </div>
          </form>
        </div>


      </div>
    </div>
  );
}
