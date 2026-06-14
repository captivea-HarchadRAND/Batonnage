import { useState, useRef, useEffect } from 'react';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const RANK_CONFIG = {
  1: { medal: '🥇', label: 'Top Performer',  bg: 'linear-gradient(135deg,#f59e0b22,#fbbf2422)', border: '#f59e0b', color: '#d97706' },
  2: { medal: '🥈', label: '2ème du podium', bg: 'linear-gradient(135deg,#94a3b822,#cbd5e122)', border: '#94a3b8', color: '#64748b' },
  3: { medal: '🥉', label: '3ème du podium', bg: 'linear-gradient(135deg,#b4590922,#d9770622)', border: '#b45309', color: '#92400e' },
};

function BadgeCard({ badge, stretch }) {
  const cfg = RANK_CONFIG[badge.rank] || RANK_CONFIG[3];
  const monthName = MONTH_FR[badge.month - 1];
  return (
    <div style={{
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      flex: stretch ? 1 : undefined,
    }}>
      <div style={{ fontSize: 24, lineHeight: 1 }}>{cfg.medal}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 11, color: cfg.color }}>{cfg.label}</div>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{monthName} {badge.year}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{badge.rdv_done} RDV done</div>
      </div>
    </div>
  );
}

const MONTH_LABEL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function MonthStats({ stats }) {
  const { pris, done, no_show, objectif, month, year } = stats;
  const taux = pris > 0 ? Math.round((done / pris) * 100) : 0;
  const progress = objectif ? Math.min(100, Math.round((done / objectif) * 100)) : null;

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title" style={{ marginBottom: 16 }}>
        📅 Mois en cours — {MONTH_LABEL[month - 1]} {year}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatBox icon="📋" label="RDV pris" value={pris} color="var(--primary)" />
        <StatBox icon="✅" label="RDV done" value={done} color="#22c55e" />
        <StatBox icon="❌" label="No show" value={no_show} color="#f97316" />
        <StatBox icon="📊" label="Taux done" value={`${taux}%`} color="#a78bfa" />
        {objectif && (
          <div style={{
            flex: '1 1 200px', background: 'var(--surface2)', borderRadius: 12,
            padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🎯 Objectif mensuel</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{done} / {objectif}</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${progress}%`,
                background: progress >= 100 ? '#22c55e' : progress >= 60 ? '#a78bfa' : 'var(--primary)',
                transition: 'width .4s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{progress}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <div style={{
      flex: '1 1 100px', background: 'var(--surface2)', borderRadius: 12,
      padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100,
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function RankRow({ entry, highlight, muted }) {
  const initials = entry.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px', borderRadius: 10,
      background: highlight ? 'var(--primary)22' : 'transparent',
      border: highlight ? '1.5px solid var(--primary)55' : '1.5px solid transparent',
      opacity: muted ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 20, textAlign: 'center' }}>
        #{entry.rank}
      </span>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff',
      }}>
        {entry.avatar
          ? <img src={entry.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: highlight ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.name}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{entry.done}</span>
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function resizeImage(file, maxPx = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible ou format non supporté'));
    };
    img.src = url;
  });
}

export default function Profile() {
  const { user, setUser } = useUser();
  const [name, setName]           = useState(user?.name || '');
  const [password, setPassword]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [preview, setPreview]     = useState(null);
  const [badges, setBadges]       = useState([]);
  const [badgePage, setBadgePage] = useState(0);
  const [monthStats, setMonthStats] = useState(null);
  const [rankData, setRankData]   = useState(null);
  const BADGES_PER_PAGE = 5;
  const fileRef = useRef(null);

  useEffect(() => {
    api.getBadges().then(setBadges).catch(() => {});
    api.getProfileStats().then(setMonthStats).catch(() => {});
    api.getProfileRank().then(setRankData).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (newPassword && newPassword !== confirm) return setError('Les nouveaux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      const payload = { name };
      if (newPassword) { payload.password = password; payload.new_password = newPassword; }
      const { user: updated } = await api.updateProfile(payload);
      setUser(updated);
      setSuccess('Profil mis à jour avec succès.');
      setPassword(''); setNewPassword(''); setConfirm('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const base64 = await resizeImage(file);
      setPreview(base64);
    } catch (err) {
      setError(err.message || "Impossible de charger l'image.");
    }
  };

  const handleSaveAvatar = async () => {
    if (!preview) return;
    setAvatarLoading(true);
    try {
      const { user: updated } = await api.updateAvatar(preview);
      setUser(updated);
      setPreview(null);
      setSuccess('Photo de profil mise à jour.');
    } catch (err) { setError(err.message); }
    finally { setAvatarLoading(false); }
  };

  const currentAvatar = preview || user?.avatar;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">👤 Mon Profil</div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Avatar */}
        <div className="card" style={{ width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 28 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 120, height: 120, borderRadius: '50%', cursor: 'pointer',
              overflow: 'hidden', border: '3px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', position: 'relative',
              fontSize: currentAvatar ? 0 : 36, fontWeight: 700, color: 'var(--primary)',
            }}
          >
            {currentAvatar
              ? <img src={currentAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(user?.name)
            }
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity .2s', fontSize: 28,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >📷</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <div className="text-muted text-sm" style={{ textAlign: 'center', lineHeight: 1.5 }}>
            Cliquez sur la photo<br />pour changer l'image
          </div>
          {preview && (
            <div className="flex gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm" disabled={avatarLoading} onClick={handleSaveAvatar}>
                {avatarLoading ? <span className="spinner" /> : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        {/* Infos */}
        <div className="card" style={{ flex: '2 1 340px' }}>
          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Nom complet</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Prénom NOM" required />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>Changer le mot de passe</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Mot de passe actuel</label>
                  <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nouveau mot de passe</label>
                  <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmer</label>
                  <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sauvegarder'}
            </button>
          </form>
        </div>

        {/* Badges — à droite, même hauteur que le formulaire */}
        <div className="card" style={{
          flex: '1 1 340px', alignSelf: 'stretch', minWidth: 200,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-title" style={{ margin: 0 }}>🏅 Mes badges</div>
            {badges.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {badgePage * BADGES_PER_PAGE + 1}–{Math.min((badgePage + 1) * BADGES_PER_PAGE, badges.length)} / {badges.length}
              </span>
            )}
          </div>

          {badges.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Aucun badge pour le moment.</div>
            : <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {badges.slice(badgePage * BADGES_PER_PAGE, (badgePage + 1) * BADGES_PER_PAGE).map((b, i) => (
                    <BadgeCard key={i} badge={b} stretch />
                  ))}
                </div>
                {badges.length > BADGES_PER_PAGE && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 'auto', paddingTop: 8 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={badgePage === 0}
                      onClick={() => setBadgePage(p => p - 1)}
                    >← Préc</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={(badgePage + 1) * BADGES_PER_PAGE >= badges.length}
                      onClick={() => setBadgePage(p => p + 1)}
                    >Suiv →</button>
                  </div>
                )}
              </>
          }
        </div>

        {/* Classement ce mois — dernière carte */}
        {rankData && (
          <div className="card" style={{
            flex: '1 1 220px', alignSelf: 'stretch', minWidth: 200,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div className="card-title" style={{ marginBottom: 0 }}>🏆 Classement ce mois</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6 }}>{rankData.total} SDRs actifs</div>

            {rankData.ranked ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                  {rankData.above ? <RankRow entry={rankData.above} muted /> : <div style={{ height: 38 }} />}
                  <RankRow entry={{ ...rankData.current, rank: rankData.rank }} highlight />
                  {rankData.below ? <RankRow entry={rankData.below} muted /> : <div style={{ height: 38 }} />}
                </div>
                <div style={{ textAlign: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: rankData.rank <= 3 ? '#f59e0b' : 'var(--primary)' }}>
                    #{rankData.rank}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>/ {rankData.total}</span>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <style>{`
                  @keyframes hashSpin {
                    0%   { transform: rotateY(0deg) scale(1); filter: hue-rotate(0deg); }
                    40%  { transform: rotateY(180deg) scale(1.1); filter: hue-rotate(120deg); }
                    60%  { transform: rotateY(180deg) scale(1.1); filter: hue-rotate(200deg); }
                    100% { transform: rotateY(360deg) scale(1); filter: hue-rotate(360deg); }
                  }
                `}</style>
                <span style={{
                  fontSize: 96, fontWeight: 900, lineHeight: 1,
                  background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                  animation: 'hashSpin 3s ease-in-out infinite',
                  transformStyle: 'preserve-3d',
                }}>#</span>
              </div>
            )}
          </div>
        )}
      </div>

      {monthStats && <MonthStats stats={monthStats} />}
    </div>
  );
}
