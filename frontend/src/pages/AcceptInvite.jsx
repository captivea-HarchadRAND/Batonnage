import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../context/UserContext.jsx';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [inviteUser, setInviteUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getInvite(token)
      .then(({ user }) => setInviteUser(user))
      .catch(() => setError('Invitation invalide ou expirée.'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');
    if (password.length < 6) return setError('Mot de passe trop court (min 6 caractères).');
    setLoading(true);
    try {
      const { user } = await api.acceptInvite(token, password);
      setUser(user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">B</div>
          <div className="login-logo-title">Bienvenue !</div>
          {inviteUser && <div className="login-logo-sub">Bonjour {inviteUser.name}, créez votre mot de passe.</div>}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {inviteUser && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={inviteUser.email} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Répéter le mot de passe"
                required
              />
            </div>
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Créer mon compte'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
