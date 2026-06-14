import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const { login } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlError = params.get('error');
    if (urlError) setError(urlError.slice(0, 120));
  }, []);

  const titleRef = useRef(null);
  const tallyBgRef = useRef(null);
  const tallyFooterRef = useRef(null);
  const orbCRef = useRef(null);

  // Letter-by-letter drop animation on title
  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    title.innerHTML = '';
    'Batonnage'.split('').forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'l';
      span.textContent = ch;
      span.style.animationDelay = (i * 80) + 'ms';
      title.appendChild(span);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add('run')));
  }, []);

  // Tally footer decorative marks
  useEffect(() => {
    const footer = tallyFooterRef.current;
    if (!footer) return;
    const groups = [5, 5, 5, 2];
    const allEls = [];
    groups.forEach(cnt => {
      const tg = document.createElement('div');
      tg.className = 'tg';
      const n = Math.min(cnt, 4);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div');
        s.className = 's'; tg.appendChild(s); allEls.push(s);
      }
      if (cnt === 5) {
        const c = document.createElement('div');
        c.className = 'cross'; tg.appendChild(c); allEls.push(c);
      }
      footer.appendChild(tg);
    });
    allEls.forEach((el, i) => setTimeout(() => el.classList.add('on'), 700 + i * 100));
    return () => { footer.innerHTML = ''; };
  }, []);

  // Floating tally marks in background
  useEffect(() => {
    const bg = tallyBgRef.current;
    if (!bg) return;
    const rand = (a, b) => a + Math.random() * (b - a);
    const spawn = () => {
      const x = rand(3, 95), y = rand(3, 95);
      const cnt = Math.floor(rand(1, 6)), sz = rand(14, 32);
      const dur = rand(6, 12), rot = rand(-32, 32);
      const n = Math.min(cnt, 4);
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:absolute;left:${x}%;top:${y}%;display:flex;align-items:flex-end;gap:3px;transform:rotate(${rot}deg);opacity:0;transition:opacity 0.6s ease;`;
      for (let i = 0; i < n; i++) {
        const v = document.createElement('div');
        v.style.cssText = `width:2.5px;height:${sz}px;border-radius:2px;background:rgba(100,160,255,.35);`;
        wrap.appendChild(v);
      }
      if (cnt === 5) {
        const d = document.createElement('div');
        d.style.cssText = `position:absolute;left:-2px;top:50%;width:${n*(2.5+3)+sz*0.8}px;height:2.5px;background:rgba(100,160,255,.35);border-radius:2px;transform:translateY(-50%) rotate(-20deg);`;
        wrap.appendChild(d);
      }
      bg.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wrap.style.opacity = String(rand(0.1, 0.28));
        setTimeout(() => { wrap.style.opacity = '0'; }, dur * 700);
        setTimeout(() => { wrap.remove(); }, (dur + 1) * 1000);
      }));
    };
    for (let i = 0; i < 10; i++) setTimeout(spawn, i * 300);
    const iv = setInterval(spawn, 800);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const onFocus = () => { if (orbCRef.current) orbCRef.current.style.opacity = '.42'; };
  const onBlur  = () => { if (orbCRef.current) orbCRef.current.style.opacity = ''; };

  return (
    <>
      {/* Fixed animated background */}
      <div className="ln-bg">
        <div className="ln-grid" />
        <div className="ln-orb ln-orb-a" />
        <div className="ln-orb ln-orb-b" />
        <div className="ln-orb ln-orb-c" ref={orbCRef} />
        <div className="ln-tally-bg" ref={tallyBgRef} />
      </div>

      {/* Page */}
      <div className="ln-page">
        <div className="ln-card">

          {/* Logo + title */}
          <div className="ln-logo-block">
            <div className="ln-logo-wrap">
              <div className="ln-logo">
                <div className="ln-logo-tally">
                  <div className="lt-v"/><div className="lt-v"/>
                  <div className="lt-v"/><div className="lt-v"/>
                  <div className="lt-diag"/>
                </div>
              </div>
            </div>
            <h1 className="ln-title" ref={titleRef} data-text="Batonnage">Batonnage</h1>
            <p className="ln-sub">Suivi des RDVs SDR</p>
          </div>

          <div className="ln-divider" />

          <form onSubmit={handleSubmit}>
            <div className={`ln-form-inner${success ? ' hide' : ''}`}>
              {error && <div className="ln-error">{error}</div>}

              <div className="ln-fields">
                <div className="ln-field">
                  <label className="ln-label">Email</label>
                  <div className="ln-input-wrap">
                    <input className="ln-input" type="email" placeholder="example@captivea.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      onFocus={onFocus} onBlur={onBlur}
                      autoComplete="username" required autoFocus />
                    <svg className="ln-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>
                    </svg>
                  </div>
                </div>

                <div className="ln-field">
                  <label className="ln-label">Mot de passe</label>
                  <div className="ln-input-wrap">
                    <input className="ln-input" type="password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      onFocus={onFocus} onBlur={onBlur}
                      autoComplete="current-password" required />
                    <svg className="ln-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 6 }}>
                <button className={`ln-btn${loading ? ' ln-btn-loading' : ''}`} type="submit" disabled={loading}>
                  <span className="ln-btn-text">Se connecter</span>
                </button>
              </div>

              <div className="ln-or">
                <span>ou</span>
              </div>

              <a href="/api/auth/microsoft" className="ln-ms-btn">
                <svg width="16" height="16" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                </svg>
                Se connecter avec Microsoft
              </a>
            </div>

            {/* Success state */}
            <div className={`ln-success${success ? ' show' : ''}`}>
              <div className="ln-check-ring">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="ln-suc-title">Connexion réussie !</p>
              <p className="ln-suc-sub">Redirection vers le dashboard…</p>
            </div>
          </form>

          <div className="ln-tally-footer" ref={tallyFooterRef} />
        </div>
      </div>
    </>
  );
}
