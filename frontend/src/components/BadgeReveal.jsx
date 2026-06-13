import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const RANK_CFG = {
  1: { medal:'🥇', label:'Top Performer du mois !', color:'#f59e0b', glow:'rgba(245,158,11,0.5)' },
  2: { medal:'🥈', label:'2ème du podium !',         color:'#94a3b8', glow:'rgba(148,163,184,0.4)' },
  3: { medal:'🥉', label:'3ème du podium !',         color:'#b45309', glow:'rgba(180,83,9,0.4)'   },
};

const PARTICLES = ['⭐','✨','🌟','💫','🎉','🎊','🏅'];

export default function BadgeReveal({ badges, bellRef, onDone }) {
  const [phase, setPhase]       = useState('intro');   // intro → fly → done
  const [idx, setIdx]           = useState(0);
  const medalRef                = useRef(null);
  const badge                   = badges[idx];
  const cfg                     = RANK_CFG[badge?.rank] || RANK_CFG[3];

  const isLast = idx === badges.length - 1;

  // Passer au badge suivant
  const handleNext = () => setIdx(i => i + 1);

  // Dernier badge : lancer le vol vers la cloche
  const handleDismiss = () => {
    api.markBadgesSeen().catch(() => {});
    if (!bellRef?.current || !medalRef?.current) { onDone(); return; }

    const from = medalRef.current.getBoundingClientRect();
    const to   = bellRef.current.getBoundingClientRect();

    const el = document.createElement('div');
    el.textContent = cfg.medal;
    el.style.cssText = `
      position:fixed; z-index:9999; font-size:48px; pointer-events:none;
      left:${from.left + from.width/2 - 24}px;
      top:${from.top  + from.height/2 - 24}px;
      transition: left .7s cubic-bezier(.4,0,.2,1),
                  top .7s cubic-bezier(.4,0,.2,1),
                  font-size .7s ease,
                  opacity .7s ease,
                  transform .7s ease;
      transform: rotate(0deg);
    `;
    document.body.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left      = `${to.left + to.width/2 - 12}px`;
      el.style.top       = `${to.top  + to.height/2 - 12}px`;
      el.style.fontSize  = '20px';
      el.style.opacity   = '0.2';
      el.style.transform = 'rotate(720deg)';
    }));

    setTimeout(() => { el.remove(); setPhase('done'); onDone(); }, 800);
  };

  if (phase === 'done' || !badge) return null;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center',
      animation:'fadeIn .3s ease',
    }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes reveal  { 0%{transform:scale(0) rotate(-15deg);opacity:0}
                             70%{transform:scale(1.12) rotate(3deg)}
                             100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 40px ${cfg.glow}}
                             50%{box-shadow:0 0 80px ${cfg.glow}, 0 0 120px ${cfg.glow}} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes particle{ 0%{opacity:1;transform:translate(0,0) scale(1)}
                             100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }
      `}</style>

      {/* Particules */}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position:'absolute',
          left:`${20 + (i * 60) % 80}%`,
          top:`${10 + (i * 37) % 70}%`,
          fontSize: 20 + (i % 3) * 10,
          animation:`particle ${1.2 + i*0.2}s ease forwards`,
          animationDelay: `${i * 0.08}s`,
          '--tx': `${(i%2===0?1:-1) * (40+i*15)}px`,
          '--ty': `${-60 - i*20}px`,
          pointerEvents:'none',
        }}>{p}</div>
      ))}

      {/* Carte badge */}
      <div style={{
        background:'var(--surface)', borderRadius:24, padding:'40px 48px',
        textAlign:'center', maxWidth:380, width:'90vw',
        border:`3px solid ${cfg.color}`,
        animation:'reveal .6s cubic-bezier(.34,1.56,.64,1) forwards, pulse 2s ease 0.6s infinite',
        position:'relative',
      }}>
        {/* Médaille */}
        <div ref={medalRef} style={{
          fontSize:96, lineHeight:1, marginBottom:16,
          display:'inline-block',
          animation:'float 2s ease-in-out .6s infinite',
        }}>{cfg.medal}</div>

        {badges.length > 1 && (
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
            {idx + 1} / {badges.length}
          </div>
        )}
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
          Félicitations !
        </div>
        <div style={{ fontSize:24, fontWeight:900, color:cfg.color, marginBottom:8, lineHeight:1.2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>
          {MONTH_FR[badge.month - 1]} {badge.year}
        </div>
        <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:28 }}>
          {badge.rdv_done} RDV done ce mois 🎯
        </div>

        {isLast ? (
          <button
            onClick={handleDismiss}
            style={{
              background:cfg.color, color:'#fff', border:'none', borderRadius:12,
              padding:'12px 32px', fontSize:15, fontWeight:700, cursor:'pointer',
              boxShadow:`0 4px 20px ${cfg.glow}`, transition:'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
          >
            Voir mes badges 🚀
          </button>
        ) : (
          <button
            onClick={handleNext}
            style={{
              background:cfg.color, color:'#fff', border:'none', borderRadius:12,
              padding:'12px 32px', fontSize:15, fontWeight:700, cursor:'pointer',
              boxShadow:`0 4px 20px ${cfg.glow}`, transition:'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
          >
            Suivant →
          </button>
        )}
      </div>
    </div>
  );
}
