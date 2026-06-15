const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
// const nodemailer = require('nodemailer'); // email désactivé
const { getDB, saveDB } = require('./db');

// Load .env if present
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

const scryptAsync = promisify(scrypt);

const app = express();
app.set('trust proxy', 1); // req.ip fiable derrière un reverse proxy (nginx, etc.)
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [
  ...FRONTEND_URL.split(',').map(u => u.trim()),
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080']
    : []),
];
const SESSION_TTL_DAYS = 14;
const INVITE_TTL_DAYS = 7;
const MIN_PASSWORD_LEN = 12;
// const APP_URL = (process.env.APP_URL || 'https://batonnage.captivea.mg').replace(/\/$/, '');

// ─── Mailer (désactivé — décommenter + configurer SMTP_* dans .env pour activer) ──
// let _transporter = null;
// function getMailer() {
//   if (_transporter) return _transporter;
//   const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
//   if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
//   _transporter = nodemailer.createTransport({
//     host: SMTP_HOST,
//     port: parseInt(SMTP_PORT || '587', 10),
//     secure: process.env.SMTP_SECURE === 'true',
//     auth: { user: SMTP_USER, pass: SMTP_PASS },
//   });
//   return _transporter;
// }
//
// async function sendInviteEmail(name, email, token) {
//   const mailer = getMailer();
//   if (!mailer) return;
//   const from = process.env.SMTP_FROM || `Batonnage <noreply@captivea.mg>`;
//   const link = `${APP_URL}/invite/${token}`;
//   const html = `<!DOCTYPE html>
// <html lang="fr">
// <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
// <body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
//   <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px">
//     <tr><td align="center">
//       <table width="520" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;max-width:520px;width:100%">
//         <tr>
//           <td style="background:linear-gradient(135deg,#1a2a4a 0%,#0d1b35 100%);padding:36px 40px;text-align:center">
//             <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#2563eb;border-radius:14px;margin-bottom:16px">
//               <span style="color:#fff;font-size:24px;font-weight:900;letter-spacing:-1px">|||</span>
//             </div>
//             <h1 style="margin:0;color:#e6edf3;font-size:22px;font-weight:700;letter-spacing:-0.5px">Batonnage</h1>
//             <p style="margin:6px 0 0;color:#8b949e;font-size:13px">Suivi des RDVs SDR</p>
//           </td>
//         </tr>
//         <tr>
//           <td style="padding:36px 40px">
//             <h2 style="margin:0 0 16px;color:#e6edf3;font-size:20px;font-weight:600">Bienvenue, ${name}&nbsp;!</h2>
//             <p style="margin:0 0 28px;color:#8b949e;font-size:15px;line-height:1.6">
//               Vous avez été invité(e) à rejoindre <strong style="color:#c9d1d9">Batonnage</strong>.<br>
//               Cliquez sur le bouton ci-dessous pour créer votre mot de passe et activer votre compte.
//             </p>
//             <table width="100%" cellpadding="0" cellspacing="0">
//               <tr><td align="center" style="padding:0 0 28px">
//                 <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;">
//                   Créer mon compte →
//                 </a>
//               </td></tr>
//             </table>
//             <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:14px 16px;margin-bottom:24px">
//               <p style="margin:0 0 6px;color:#8b949e;font-size:12px">Ou copiez ce lien :</p>
//               <p style="margin:0;color:#58a6ff;font-size:12px;word-break:break-all">${link}</p>
//             </div>
//             <p style="margin:0;color:#6e7681;font-size:13px;text-align:center">
//               ⏳ Ce lien est valable <strong style="color:#8b949e">${INVITE_TTL_DAYS} jours</strong>.
//             </p>
//           </td>
//         </tr>
//         <tr>
//           <td style="background:#0d1117;border-top:1px solid #21262d;padding:20px 40px;text-align:center">
//             <p style="margin:0;color:#6e7681;font-size:12px">
//               Vous recevez cet email car un administrateur vous a invité(e).<br>
//               Si vous n'attendiez pas cette invitation, ignorez ce message.
//             </p>
//           </td>
//         </tr>
//       </table>
//     </td></tr>
//   </table>
// </body>
// </html>`;
//   await mailer.sendMail({
//     from,
//     to: email,
//     subject: `Invitation à rejoindre Batonnage`,
//     html,
//     text: `Bonjour ${name},\n\nActivez votre compte ici : ${link}\n\nCe lien expire dans ${INVITE_TTL_DAYS} jours.`,
//   });
// }

function validatePassword(pw) {
  if (!pw || pw.length < MIN_PASSWORD_LEN) return `Minimum ${MIN_PASSWORD_LEN} caractères requis.`;
  if (!/[A-Z]/.test(pw)) return 'Au moins une lettre majuscule requise.';
  if (!/[a-z]/.test(pw)) return 'Au moins une lettre minuscule requise.';
  if (!/[0-9]/.test(pw)) return 'Au moins un chiffre requis.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Au moins un caractère spécial requis (!@#$%...).';
  return null;
}

// Microsoft Azure AD SSO
const AZURE_CLIENT_ID     = process.env.AZURE_CLIENT_ID || '';
const AZURE_TENANT_ID     = process.env.AZURE_TENANT_ID || 'common';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const APP_URL = (process.env.APP_URL || 'https://batonnage.captivea.mg').replace(/\/$/, '');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      frameAncestors: ["'none'"],
    }
  }
}));
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use((req, res, next) => {
  express.json({ limit: req.path === '/api/profile/avatar' ? '2mb' : '512kb' })(req, res, next);
});
app.use(cookieParser());
app.use((req, _res, next) => {
  if (req.ip?.startsWith('::ffff:')) req.ip = req.ip.slice(7);
  next();
});

// Serve uploaded files
const UPLOADS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve frontend in production
const DIST = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(pw, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function verifyPassword(pw, stored) {
  if (typeof stored !== 'string' || !stored.includes('.')) return false;
  const [hashed, salt] = stored.split('.');
  if (!hashed || !salt) return false;
  const expected = Buffer.from(hashed, 'hex');
  const buf = await scryptAsync(pw, salt, 64);
  // timingSafeEqual exige des buffers de même longueur — sinon il lève
  if (expected.length !== buf.length) return false;
  return timingSafeEqual(buf, expected);
}

// ── Rate-limit persisté en SQLite (résiste aux redémarrages) ─────────────────
const RL_WINDOW_MS = 15 * 60 * 1000; // 15 min

// Protège contre le blocage accidentel du proxy Nginx (127.0.0.1, ::1, LAN)
function isPrivateIp(ip) {
  if (!ip) return true;
  return ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('10.') || ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

class SqliteRateLimitStore {
  localKeys = true;
  constructor(windowMs) { this.windowMs = windowMs; }
  async increment(key) {
    const db = await getDB();
    const now = Date.now();
    db.run(`DELETE FROM rate_limits WHERE reset_time < ?`, [now]);
    const rec = dbRow(db, `SELECT hits, reset_time FROM rate_limits WHERE key=?`, [key]);
    let hits, resetTime;
    if (rec) {
      hits = rec.hits + 1;
      resetTime = rec.reset_time;
      db.run(`UPDATE rate_limits SET hits=? WHERE key=?`, [hits, key]);
    } else {
      hits = 1;
      resetTime = now + this.windowMs;
      db.run(`INSERT INTO rate_limits (key, hits, reset_time) VALUES (?,1,?)`, [key, resetTime]);
    }
    saveDB();
    return { totalHits: hits, resetTime: new Date(resetTime) };
  }
  async decrement(key) {
    const db = await getDB();
    const rec = dbRow(db, `SELECT hits FROM rate_limits WHERE key=?`, [key]);
    if (rec && rec.hits > 1) {
      db.run(`UPDATE rate_limits SET hits=hits-1 WHERE key=?`, [key]);
      saveDB();
    } else {
      db.run(`DELETE FROM rate_limits WHERE key=?`, [key]);
      saveDB();
    }
  }
  async resetKey(key) {
    const db = await getDB();
    db.run(`DELETE FROM rate_limits WHERE key=?`, [key]);
    saveDB();
  }
}

// Par IP+email : 10 tentatives / 15 min (bloque le brute-force sur un compte)
const loginRateLimit = rateLimit({
  windowMs: RL_WINDOW_MS,
  max: 10,
  store: new SqliteRateLimitStore(RL_WINDOW_MS),
  skip: (req) => isPrivateIp(req.ip),
  keyGenerator: (req) => `${req.ip}|${(req.body?.email || '').toLowerCase().trim()}`,
  handler: async (req, res) => {
    await logSecurityEvent('login_blocked', req.ip, null, (req.body?.email || '').toLowerCase().trim(), 'Rate limit IP+email');
    res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 min.' });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

// Par IP seule : 20 tentatives / 15 min (bloque le scan de comptes depuis une même IP)
const loginIpRateLimit = rateLimit({
  windowMs: RL_WINDOW_MS,
  max: 20,
  store: new SqliteRateLimitStore(RL_WINDOW_MS),
  skip: (req) => isPrivateIp(req.ip),
  keyGenerator: (req) => `ip|${req.ip}`,
  handler: async (req, res) => {
    await logSecurityEvent('login_blocked', req.ip, null, (req.body?.email || '').toLowerCase().trim(), 'Rate limit IP globale');
    res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 min.' });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

const inviteRateLimit = rateLimit({
  windowMs: RL_WINDOW_MS,
  max: 5,
  store: new SqliteRateLimitStore(RL_WINDOW_MS),
  skip: (req) => isPrivateIp(req.ip),
  keyGenerator: (req) => `invite|${req.ip}`,
  handler: (_req, res) => res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 min.' }),
  standardHeaders: false,
  legacyHeaders: false,
});

function clearLoginAttempts(req) {
  const email = (req.body?.email || '').toLowerCase().trim();
  loginRateLimit.resetKey(`${req.ip}|${email}`);
  loginIpRateLimit.resetKey(`ip|${req.ip}`);
}

async function logSecurityEvent(type, ip, userId, email, detail) {
  try {
    const db = await getDB();
    db.run(
      `INSERT INTO security_events (id, type, ip, user_id, email, detail) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), type, ip || null, userId || null, email || null, detail || null]
    );
    db.run(`DELETE FROM security_events WHERE created_at < datetime('now', '-30 days')`);
    saveDB();
  } catch (e) {
    console.error('[logSecurityEvent]', e);
  }
}

// Options cookie de session — secure auto en production
function sessionCookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_DAYS * 86400000,
  };
}

// Semaine 1 = premier lundi de janvier (pas ISO 8601 qui commence en décembre)
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // lun=1 … dim=7
  d.setDate(d.getDate() + 4 - day); // jeudi de la semaine ISO
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getISOYear(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  return d.getFullYear();
}

function dbRows(db, sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function dbRow(db, sql, params = []) {
  return dbRows(db, sql, params)[0] || null;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function isValidUUID(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Accepte UUIDs et IDs courts (marchés par défaut : mada, lux, fr…)
function isValidId(s) {
  return typeof s === 'string' && /^[a-z0-9_-]{1,64}$/i.test(s);
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function auth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const db = await getDB();
  const session = dbRow(db, `SELECT user_id FROM sessions WHERE token=? AND expires_at > datetime('now')`, [token]);
  if (!session) return res.status(401).json({ error: 'Session expirée' });
  const user = dbRow(db, `SELECT id, name, email, role, marche_id, status, avatar FROM users WHERE id=?`, [session.user_id]);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Compte désactivé' });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}

const ASSIGNABLE_ROLES = ['sdr', 'manager', 'admin'];

// Quels rôles l'appelant a-t-il le droit d'attribuer ?
// Seul un admin peut créer/promouvoir un admin. Un manager est limité à sdr/manager.
function canAssignRole(actorRole, targetRole) {
  if (!ASSIGNABLE_ROLES.includes(targetRole)) return false;
  if (targetRole === 'admin') return actorRole === 'admin';
  return actorRole === 'admin' || actorRole === 'manager';
}

// Compte les admins actifs (pour ne jamais verrouiller le dernier admin)
function countActiveAdmins(db, exceptId = null) {
  const row = dbRow(db,
    `SELECT COUNT(*) as c FROM users WHERE role='admin' AND status='active'${exceptId ? ' AND id!=?' : ''}`,
    exceptId ? [exceptId] : []);
  return row?.c ?? 0;
}

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', loginIpRateLimit, loginRateLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const db = await getDB();
  const user = dbRow(db, `SELECT id, name, email, role, marche_id, avatar, password_hash FROM users WHERE email=? AND status='active'`, [email.toLowerCase().trim()]);
  if (!user || !user.password_hash) {
    await logSecurityEvent('login_failed', req.ip, null, email.toLowerCase().trim(), 'Compte introuvable ou inactif');
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await logSecurityEvent('login_failed', req.ip, user.id, user.email, 'Mot de passe incorrect');
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  clearLoginAttempts(req); // succès → on remet le compteur à zéro

  const token = uuidv4();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();
  db.run(`INSERT INTO sessions VALUES (?,?,?,?,?)`, [token, user.id, user.name, user.role, expires]);
  saveDB();
  await logSecurityEvent('login_ok', req.ip, user.id, user.email, null);

  res.cookie('session', token, sessionCookieOpts());

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, marche_id: user.marche_id, avatar: user.avatar || null } });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) {
    const db = await getDB();
    db.run(`DELETE FROM sessions WHERE token=?`, [token]);
    saveDB();
  }
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, async (req, res) => {
  const db = await getDB();
  const marche_ids = dbRows(db, `SELECT marche_id FROM user_marches WHERE user_id=?`, [req.user.id]).map(r => r.marche_id);
  res.json({ user: { ...req.user, marche_ids } });
});

app.get('/api/auth/invite/:token', inviteRateLimit, async (req, res) => {
  const db = await getDB();
  const user = dbRow(db,
    `SELECT id, name, email FROM users WHERE invite_token=? AND (invite_expires IS NULL OR invite_expires > datetime('now'))`,
    [req.params.token]);
  if (!user) return res.status(404).json({ error: 'Invitation invalide ou expirée' });
  res.json({ user });
});

app.post('/api/auth/invite/:token', inviteRateLimit, async (req, res) => {
  const { password } = req.body;
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const db = await getDB();
  const user = dbRow(db,
    `SELECT id, name, email, role FROM users WHERE invite_token=? AND (invite_expires IS NULL OR invite_expires > datetime('now'))`,
    [req.params.token]);
  if (!user) return res.status(404).json({ error: 'Invitation invalide ou expirée' });

  const hash = await hashPassword(password);
  db.run(`UPDATE users SET password_hash=?, invite_token=NULL, invite_expires=NULL, status='active' WHERE id=?`, [hash, user.id]);
  saveDB();

  const sessionToken = uuidv4();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();
  db.run(`INSERT INTO sessions VALUES (?,?,?,?,?)`, [sessionToken, user.id, user.name, user.role, expires]);
  saveDB();

  res.cookie('session', sessionToken, sessionCookieOpts());
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ─── Microsoft SSO ───────────────────────────────────────────────────────────

app.get('/api/auth/microsoft', (req, res) => {
  if (!AZURE_CLIENT_ID) return res.redirect('/login?error=' + encodeURIComponent('SSO Microsoft non configuré'));
  const state = uuidv4();
  res.cookie('sso_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', maxAge: 300000 });
  const redirectUri = `${APP_URL}/api/auth/microsoft/callback`;
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid email profile',
    state,
  });
  res.redirect(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`);
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code, error: msError, state } = req.query;
  if (msError) return res.redirect('/login?error=' + encodeURIComponent('Connexion Microsoft annulée'));
  if (!code) return res.redirect('/login?error=' + encodeURIComponent('Code OAuth manquant'));
  if (!state || state !== req.cookies?.sso_state) return res.redirect('/login?error=' + encodeURIComponent('Requête invalide (CSRF)'));
  res.clearCookie('sso_state');
  try {
    const redirectUri = `${APP_URL}/api/auth/microsoft/callback`;
    const tokenRes = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid email profile',
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) return res.redirect('/login?error=' + encodeURIComponent('Authentification Microsoft échouée. Contactez un administrateur.'));

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const msUser = await meRes.json();
    const email = (msUser.mail || msUser.userPrincipalName || '').toLowerCase().trim();
    if (!email) return res.redirect('/login?error=' + encodeURIComponent('Email Microsoft introuvable'));

    const db = await getDB();
    const user = dbRow(db, `SELECT id, name, role FROM users WHERE email=? AND status='active'`, [email]);
    if (!user) return res.redirect('/login?error=' + encodeURIComponent('Connexion Microsoft échouée. Contactez un administrateur.'));

    const sessionToken = uuidv4();
    const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();
    db.run(`INSERT INTO sessions VALUES (?,?,?,?,?)`, [sessionToken, user.id, user.name, user.role, expires]);
    saveDB();

    res.cookie('session', sessionToken, sessionCookieOpts());
    res.redirect('/');
  } catch (err) {
    console.error('Microsoft SSO error:', err);
    res.redirect('/login?error=' + encodeURIComponent('Erreur SSO Microsoft'));
  }
});

// ─── Marchés ─────────────────────────────────────────────────────────────────

app.get('/api/marches', auth, async (req, res) => {
  const db = await getDB();
  if (req.user.role === 'sdr') {
    const marches = dbRows(db,
      `SELECT m.* FROM marches m
       JOIN user_marches um ON um.marche_id = m.id
       WHERE um.user_id = ? AND m.archived = 0
       ORDER BY m.position, m.name`,
      [req.user.id]
    );
    return res.json(marches);
  }
  const marches = dbRows(db, `SELECT * FROM marches WHERE archived=0 ORDER BY position, name`);
  res.json(marches);
});

// ─── RDVs ─────────────────────────────────────────────────────────────────────

// ── Call Issue Types ─────────────────────────────────────────────────────────
app.get('/api/call-issue-types', auth, async (req, res) => {
  const db = await getDB();
  res.json(dbRows(db, `SELECT * FROM call_issue_types ORDER BY position, label`, []));
});

app.post('/api/call-issue-types', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { icon, label, color } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'Libellé requis' });
  const db = await getDB();
  const id = uuidv4();
  const pos = (dbRow(db, `SELECT MAX(position) as m FROM call_issue_types`, [])?.m ?? -1) + 1;
  db.run(`INSERT INTO call_issue_types (id, icon, label, color, position) VALUES (?,?,?,?,?)`,
    [id, icon || '❓', label.trim(), color || '#6366f1', pos]);
  saveDB();
  res.json({ id, icon: icon || '❓', label: label.trim(), color: color || '#6366f1', position: pos });
});

app.delete('/api/call-issue-types/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`DELETE FROM call_issue_types WHERE id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// ── Call Issues ──────────────────────────────────────────────────────────────
app.post('/api/call-issues', auth, async (req, res) => {
  const { sdr_id, marche_id, issue_type, date, notes } = req.body;
  if (!issue_type) return res.status(400).json({ error: 'Type de problème requis' });
  if (sdr_id && !isValidUUID(sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });
  if (marche_id && !isValidId(marche_id)) return res.status(400).json({ error: 'marche_id invalide' });
  const targetSdr = req.user.role === 'sdr' ? req.user.id : (sdr_id || req.user.id);
  const db = await getDB();
  const id = uuidv4();
  db.run(
    `INSERT INTO call_issues (id, sdr_id, marche_id, issue_type, date, notes) VALUES (?,?,?,?,?,?)`,
    [id, targetSdr, marche_id || null, issue_type, date || new Date().toISOString().split('T')[0], notes || null]
  );
  saveDB();
  res.json({ id });
});

app.get('/api/call-issues', auth, async (req, res) => {
  const db = await getDB();
  const { start, end, sdr_id, status } = req.query;
  if (start && !isValidDate(start)) return res.status(400).json({ error: 'Date de début invalide' });
  if (end && !isValidDate(end)) return res.status(400).json({ error: 'Date de fin invalide' });
  if (sdr_id && !isValidUUID(sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });
  let sql = `SELECT ci.*, u.name as sdr_name, m.name as marche_name, m.color as marche_color
             FROM call_issues ci
             JOIN users u ON u.id = ci.sdr_id
             LEFT JOIN marches m ON m.id = ci.marche_id
             WHERE 1=1`;
  const params = [];
  if (req.user.role === 'sdr') { sql += ` AND ci.sdr_id=?`; params.push(req.user.id); }
  else if (sdr_id) { sql += ` AND ci.sdr_id=?`; params.push(sdr_id); }
  if (start) { sql += ` AND ci.date >= ?`; params.push(start); }
  if (end)   { sql += ` AND ci.date <= ?`; params.push(end); }
  const VALID_CI_STATUSES = ['open', 'dismissed', 'archived'];
  if (status === 'all') { /* pas de filtre statut */ }
  else if (status) {
    if (!VALID_CI_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    sql += ` AND ci.status=?`; params.push(status);
  } else { sql += ` AND COALESCE(ci.status,'open') != 'archived'`; }
  sql += ` ORDER BY ci.created_at DESC`;
  res.json(dbRows(db, sql, params));
});

app.put('/api/call-issues/:id/status', auth, requireRole('manager', 'admin'), async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { status } = req.body;
  if (!['open', 'dismissed', 'archived'].includes(status))
    return res.status(400).json({ error: 'Statut invalide' });
  const db = await getDB();
  db.run(`UPDATE call_issues SET status=? WHERE id=?`, [status, req.params.id]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/call-issues/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`DELETE FROM call_issues WHERE id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// ── RDVs ─────────────────────────────────────────────────────────────────────
app.get('/api/rdvs', auth, async (req, res) => {
  const db = await getDB();
  const { week, year, sdr_id, start, end, show_archived } = req.query;
  if (start && !isValidDate(start)) return res.status(400).json({ error: 'Date de début invalide' });
  if (end && !isValidDate(end)) return res.status(400).json({ error: 'Date de fin invalide' });
  if (sdr_id && !isValidUUID(sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });

  let sql = `SELECT r.*, u.name as sdr_name, u.email as sdr_email, m.name as marche_name, m.color as marche_color
             FROM rdvs r
             JOIN users u ON u.id = r.sdr_id
             JOIN marches m ON m.id = r.marche_id
             WHERE r.archived=?`;
  const params = [show_archived === '1' ? 1 : 0];

  if (req.user.role === 'sdr') {
    sql += ` AND r.sdr_id=?`;
    params.push(req.user.id);
  } else if (sdr_id) {
    sql += ` AND r.sdr_id=?`;
    params.push(sdr_id);
  }

  if (week && year) {
    sql += ` AND r.semaine=? AND r.annee=?`;
    params.push(parseInt(week), parseInt(year));
  }

  if (start) {
    sql += ` AND COALESCE(r.date_pris, r.date_prevue) >= ?`;
    params.push(start);
  }
  if (end) {
    sql += ` AND COALESCE(r.date_pris, r.date_prevue) <= ?`;
    params.push(end);
  }

  sql += ` ORDER BY r.created_at DESC`;
  const { limit } = req.query;
  if (limit) {
    const n = parseInt(limit, 10);
    if (Number.isInteger(n) && n > 0) { sql += ` LIMIT ?`; params.push(Math.min(n, 500)); }
  }
  res.json(dbRows(db, sql, params));
});

// N'autorise que les URLs http(s) — bloque les schémas dangereux (javascript:, data:, etc.)
function isSafeCrmUrl(u) {
  if (u == null || u === '') return true; // champ optionnel
  return /^https?:\/\//i.test(String(u).trim());
}

// Un SDR ne peut travailler que sur ses marchés affectés (intégrité des stats).
function sdrHasMarche(db, userId, marcheId) {
  if (!marcheId) return false;
  const row = dbRow(db,
    `SELECT 1 AS ok FROM user_marches WHERE user_id=? AND marche_id=?
     UNION SELECT 1 FROM users WHERE id=? AND marche_id=?`,
    [userId, marcheId, userId, marcheId]);
  return !!row;
}

app.post('/api/rdvs', auth, async (req, res) => {
  try {
    const { sdr_id, marche_id, crm_url_pris, date_pris, date_prevue, crm_url_done, date_done, notes, nb_appels } = req.body;

    const targetSdr = (req.user.role === 'sdr') ? req.user.id : (sdr_id || req.user.id);
    if (!marche_id) return res.status(400).json({ error: 'Marché requis' });
    if (!isValidId(marche_id)) return res.status(400).json({ error: 'marche_id invalide' });
    const isAdmin = ['admin','manager'].includes(req.user.role);
    if (!isAdmin && !crm_url_pris && !crm_url_done) return res.status(400).json({ error: 'Au moins une URL CRM requise' });
    if (!isSafeCrmUrl(crm_url_pris) || !isSafeCrmUrl(crm_url_done))
      return res.status(400).json({ error: 'URL CRM invalide (doit commencer par http:// ou https://)' });

    const now = new Date();
    const week = getISOWeek(date_pris || date_done || now);
    const year = getISOYear(date_pris || date_done || now);
    const status = crm_url_done && date_done ? 'done' : 'pris';

    const db = await getDB();

    // Un SDR ne peut créer un RDV que sur un de ses marchés
    if (req.user.role === 'sdr' && !sdrHasMarche(db, req.user.id, marche_id))
      return res.status(403).json({ error: 'Marché non autorisé' });

    // Vérifier que le lien Pris n'existe pas déjà
    if (crm_url_pris) {
      const existing = dbRow(db, `SELECT id FROM rdvs WHERE crm_url_pris=?`, [crm_url_pris]);
      if (existing) return res.status(400).json({ error: 'Ce lien CRM (Pris) existe déjà — ce RDV a déjà été enregistré.' });
    }

    const id = uuidv4();
    db.run(
      `INSERT INTO rdvs (id, sdr_id, marche_id, semaine, annee, crm_url_pris, date_pris, date_prevue, crm_url_done, date_done, status, notes, nb_appels)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, targetSdr, marche_id, week, year, crm_url_pris ?? null, date_pris ?? null, date_prevue ?? null,
       crm_url_done ?? null, date_done ?? null, status, notes ?? null, Math.max(0, Math.min(parseInt(nb_appels) || 0, 999))]
    );
    saveDB();

    const rdv = dbRow(db,
      `SELECT r.*, u.name as sdr_name, m.name as marche_name, m.color as marche_color
       FROM rdvs r JOIN users u ON u.id=r.sdr_id JOIN marches m ON m.id=r.marche_id WHERE r.id=?`, [id]);
    res.status(201).json(rdv);
  } catch (err) {
    console.error('[POST /api/rdvs]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/rdvs/:id', auth, async (req, res) => {
  try {
    const db = await getDB();
    const rdv = dbRow(db, `SELECT * FROM rdvs WHERE id=?`, [req.params.id]);
    if (!rdv) return res.status(404).json({ error: 'RDV introuvable' });
    if (req.user.role === 'sdr' && rdv.sdr_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });

    const { crm_url_pris, date_pris, date_prevue, crm_url_done, date_done, notes, marche_id, status: bodyStatus } = req.body;
    if (!isSafeCrmUrl(crm_url_pris) || !isSafeCrmUrl(crm_url_done))
      return res.status(400).json({ error: 'URL CRM invalide (doit commencer par http:// ou https://)' });
    if (marche_id !== undefined && !isValidId(marche_id))
      return res.status(400).json({ error: 'marche_id invalide' });
    // Un SDR ne peut pas déplacer un RDV vers un marché qui n'est pas le sien
    if (req.user.role === 'sdr' && marche_id != null && marche_id !== rdv.marche_id && !sdrHasMarche(db, req.user.id, marche_id))
      return res.status(403).json({ error: 'Marché non autorisé' });
    let status;
    if (bodyStatus === 'no_show') {
      status = 'no_show';
    } else {
      status = (crm_url_done || rdv.crm_url_done) && (date_done || rdv.date_done) ? 'done' : 'pris';
    }

    db.run(
      `UPDATE rdvs SET crm_url_pris=COALESCE(?,crm_url_pris), date_pris=COALESCE(?,date_pris),
       date_prevue=COALESCE(?,date_prevue), crm_url_done=COALESCE(?,crm_url_done),
       date_done=COALESCE(?,date_done), notes=COALESCE(?,notes), marche_id=COALESCE(?,marche_id), status=?
       WHERE id=?`,
      [crm_url_pris ?? null, date_pris ?? null, date_prevue ?? null, crm_url_done ?? null,
       date_done ?? null, notes ?? null, marche_id ?? null, status, req.params.id]
    );
    saveDB();

    const updated = dbRow(db,
      `SELECT r.*, u.name as sdr_name, m.name as marche_name, m.color as marche_color
       FROM rdvs r JOIN users u ON u.id=r.sdr_id JOIN marches m ON m.id=r.marche_id WHERE r.id=?`,
      [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/rdvs/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/rdvs/bulk-archive', auth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'IDs requis' });
  const safeIds = ids.filter(isValidUUID);
  if (!safeIds.length) return res.json({ ok: true });
  const db = await getDB();
  const ph = safeIds.map(() => '?').join(',');
  const rdvs = dbRows(db, `SELECT id, sdr_id FROM rdvs WHERE id IN (${ph})`, safeIds);
  const allowed = rdvs.filter(r => req.user.role !== 'sdr' || r.sdr_id === req.user.id).map(r => r.id);
  if (allowed.length) {
    const ph2 = allowed.map(() => '?').join(',');
    db.run(`UPDATE rdvs SET archived=1 WHERE id IN (${ph2})`, allowed);
    saveDB();
  }
  res.json({ ok: true });
});

app.post('/api/rdvs/bulk-delete', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'IDs requis' });
  const db = await getDB();
  ids.filter(isValidUUID).forEach(id => db.run(`DELETE FROM rdvs WHERE id=?`, [id]));
  saveDB();
  res.json({ ok: true });
});

app.post('/api/rdvs/bulk-done', auth, async (req, res) => {
  const { ids, date_done } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'IDs requis' });
  if (date_done && !isValidDate(date_done)) return res.status(400).json({ error: 'Date invalide' });
  const safeIds = ids.filter(isValidUUID);
  if (!safeIds.length) return res.json({ ok: true, count: 0 });
  const db = await getDB();
  const today = date_done || new Date().toISOString().split('T')[0];
  const ph = safeIds.map(() => '?').join(',');
  const rdvs = dbRows(db, `SELECT id, sdr_id FROM rdvs WHERE id IN (${ph})`, safeIds);
  const allowed = rdvs.filter(r => req.user.role !== 'sdr' || r.sdr_id === req.user.id).map(r => r.id);
  if (allowed.length) {
    const ph2 = allowed.map(() => '?').join(',');
    db.run(`UPDATE rdvs SET status='done', date_done=? WHERE id IN (${ph2})`, [today, ...allowed]);
    saveDB();
  }
  res.json({ ok: true, count: allowed.length });
});

app.delete('/api/rdvs/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  const db = await getDB();
  const rdv = dbRow(db, `SELECT * FROM rdvs WHERE id=?`, [req.params.id]);
  if (!rdv) return res.status(404).json({ error: 'RDV introuvable' });
  db.run(`DELETE FROM rdvs WHERE id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

app.put('/api/rdvs/:id/archive', auth, async (req, res) => {
  const db = await getDB();
  const rdv = dbRow(db, `SELECT * FROM rdvs WHERE id=?`, [req.params.id]);
  if (!rdv) return res.status(404).json({ error: 'RDV introuvable' });
  if (req.user.role === 'sdr' && rdv.sdr_id !== req.user.id)
    return res.status(403).json({ error: 'Accès refusé' });
  const newVal = rdv.archived ? 0 : 1;
  db.run(`UPDATE rdvs SET archived=? WHERE id=?`, [newVal, req.params.id]);
  saveDB();
  res.json({ ok: true, archived: newVal });
});

// ─── Stats & Dashboard ───────────────────────────────────────────────────────

app.get('/api/stats', auth, async (req, res) => {
  try {
    const db = await getDB();
    const now = new Date();
    const week = getISOWeek(now);
    const year = getISOYear(now);
    const month = now.getMonth() + 1;
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

    const isSdr = req.user.role === 'sdr';
    const sdrFilter = isSdr ? 'AND r.sdr_id=?' : '';
    const sdrP = isSdr ? [req.user.id] : [];

    const thisWeek = dbRow(db,
      `SELECT COUNT(*) as total,
         SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
         SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM rdvs r WHERE semaine=? AND annee=? ${sdrFilter}`,
      [week, year, ...sdrP]);

    // Stats mensuelles — basées sur date_pris pour le mois courant
    const thisMonth = dbRow(db,
      `SELECT COUNT(*) as total,
         SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
         SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM rdvs r
       WHERE strftime('%Y-%m', date_pris) = ? ${sdrFilter}`,
      [monthKey, ...sdrP]);

    const total = dbRow(db,
      `SELECT COUNT(*) as total,
         SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
         SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM rdvs r WHERE 1=1 ${sdrFilter}`, sdrP);

    let objectif = null;
    if (req.user.role === 'sdr') {
      const obj = dbRow(db, `SELECT objectif_rdv_done FROM objectifs WHERE sdr_id=?`, [req.user.id]);
      objectif = obj?.objectif_rdv_done ?? 8;
    }

    res.json({ thisWeek, thisMonth, total, week, month, year, objectif });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Helpers: objectif historique par période ────────────────────────────────

function buildHistoryBySdr(db, sdrIds) {
  if (!sdrIds.length) return {};
  const ph = sdrIds.map(() => '?').join(',');
  const rows = dbRows(db,
    `SELECT sdr_id, objectif, effective_from FROM objectif_history WHERE sdr_id IN (${ph}) ORDER BY effective_from ASC`,
    sdrIds);
  const map = {};
  rows.forEach(h => { (map[h.sdr_id] = map[h.sdr_id] || []).push(h); });
  return map;
}

function effectiveObj(hist, sdrId, ym) {
  const entries = (hist[sdrId] || []).filter(h => h.effective_from <= ym);
  if (entries.length > 0) return entries[entries.length - 1].objectif;
  return 8;
}

function periodObjFromHistory(hist, sdrId, start, end) {
  const s = (start || end)?.slice(0, 7);
  const e = (end || start)?.slice(0, 7);
  if (!s) {
    const now = new Date();
    return effectiveObj(hist, sdrId, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }
  let total = 0;
  let [y, m] = s.split('-').map(Number);
  const [ye, me] = e.split('-').map(Number);
  while (y < ye || (y === ye && m <= me)) {
    total += effectiveObj(hist, sdrId, `${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return total;
}

// ─── Synthesis (manager/admin) ────────────────────────────────────────────────

app.get('/api/synthesis', auth, requireRole('manager', 'admin'), async (req, res) => {
 try {
  const db = await getDB();
  const { start, end } = req.query;
  if (start && !isValidDate(start)) return res.status(400).json({ error: 'Date de début invalide' });
  if (end && !isValidDate(end)) return res.status(400).json({ error: 'Date de fin invalide' });

  let prisFilter = '';
  let doneFilter = '';
  const params = [];
  if (start) { prisFilter += ' AND r.date_pris >= ?'; params.push(start); }
  if (end)   { prisFilter += ' AND r.date_pris <= ?'; params.push(end); }
  if (start) { doneFilter += ' AND r.date_done >= ?'; params.push(start); }
  if (end)   { doneFilter += ' AND r.date_done <= ?'; params.push(end); }

  const rows = dbRows(db,
    `SELECT u.id as sdr_id, u.name as sdr_name, u.email as sdr_email,
       m.id as marche_id, m.name as marche_name, m.color as marche_color,
       SUM(CASE WHEN (r.crm_url_pris IS NOT NULL OR r.notes='saisie manuelle') AND COALESCE(r.archived,0)=0 ${prisFilter} THEN 1 ELSE 0 END) as rdv_pris,
       SUM(CASE WHEN r.status='done' AND COALESCE(r.archived,0)=0 ${doneFilter} THEN 1 ELSE 0 END) as rdv_done,
       COALESCE(o.objectif_rdv_done, 8) as objectif
     FROM users u
     JOIN marches m ON m.id = u.marche_id AND m.archived = 0
     LEFT JOIN rdvs r ON r.sdr_id = u.id
     LEFT JOIN objectifs o ON o.sdr_id = u.id
     WHERE u.status='active' AND u.role='sdr' AND u.marche_id IS NOT NULL
     GROUP BY u.id, u.name, u.email, m.id, m.name, m.color
     ORDER BY m.position, m.name, u.name`,
    params);

  // Objectif historique par SDR pour la période start→end
  const hist = buildHistoryBySdr(db, rows.map(r => r.sdr_id));

  // Group by marché
  const grouped = {};
  rows.forEach(row => {
    if (!grouped[row.marche_id]) {
      grouped[row.marche_id] = {
        marche_id: row.marche_id,
        marche_name: row.marche_name,
        marche_color: row.marche_color,
        sdrs: [],
        total_pris: 0,
        total_done: 0,
      };
    }
    const periodObj = periodObjFromHistory(hist, row.sdr_id, start, end);
    const ratio = periodObj > 0 ? (row.rdv_done / periodObj) : 0;
    grouped[row.marche_id].sdrs.push({ ...row, objectif: periodObj, ratio });
    grouped[row.marche_id].total_pris += row.rdv_pris || 0;
    grouped[row.marche_id].total_done += row.rdv_done || 0;
  });

  res.json(Object.values(grouped));
 } catch (err) { console.error('[GET /api/synthesis]', err); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

app.get('/api/leaderboard', auth, async (req, res) => {
 try {
  const db = await getDB();
  const { start, end } = req.query;
  if (start && !isValidDate(start)) return res.status(400).json({ error: 'Date de début invalide' });
  if (end && !isValidDate(end)) return res.status(400).json({ error: 'Date de fin invalide' });

  let prisFilter = '';
  let doneFilter = '';
  const params = [];
  if (start) { prisFilter += ' AND r.date_pris >= ?'; params.push(start); }
  if (end)   { prisFilter += ' AND r.date_pris <= ?'; params.push(end); }
  if (start) { doneFilter += ' AND r.date_done >= ?'; params.push(start); }
  if (end)   { doneFilter += ' AND r.date_done <= ?'; params.push(end); }

  const rows = dbRows(db,
    `SELECT u.id, u.name, u.avatar, m.name as marche_name, m.color as marche_color,
       SUM(CASE WHEN (r.crm_url_pris IS NOT NULL OR r.notes='saisie manuelle') AND COALESCE(r.archived,0)=0 ${prisFilter} THEN 1 ELSE 0 END) as rdv_pris,
       SUM(CASE WHEN r.status='done' AND COALESCE(r.archived,0)=0 ${doneFilter} THEN 1 ELSE 0 END) as rdv_done,
       COALESCE(o.objectif_rdv_done, 8) as objectif
     FROM users u
     LEFT JOIN marches m ON m.id = u.marche_id
     LEFT JOIN rdvs r ON r.sdr_id = u.id
     LEFT JOIN objectifs o ON o.sdr_id = u.id
     WHERE u.status='active' AND u.role='sdr'
     GROUP BY u.id, u.name, m.name, m.color
     ORDER BY rdv_done DESC, rdv_pris DESC`,
    params);

  // Appels (call_logs) pour la même période — filtrage par lundi de la semaine ISO
  const mondayExpr = `date(
    date(CAST(annee AS TEXT) || '-01-04',
         CAST(-((CAST(strftime('%w', CAST(annee AS TEXT) || '-01-04') AS INTEGER) + 6) % 7) AS TEXT) || ' days'),
    CAST((semaine - 1) * 7 AS TEXT) || ' days'
  )`;
  const appelConds = [];
  const appelP = [];
  if (start) { appelConds.push(`${mondayExpr} >= ?`); appelP.push(start); }
  if (end)   { appelConds.push(`${mondayExpr} <= ?`); appelP.push(end); }
  const appelWhere = appelConds.length ? 'WHERE ' + appelConds.join(' AND ') : '';
  const appelRows = dbRows(db,
    `SELECT sdr_id, SUM(nb_appels) as total_appels FROM call_logs ${appelWhere} GROUP BY sdr_id`,
    appelP);
  const appelMap = {};
  appelRows.forEach(r => { appelMap[r.sdr_id] = r.total_appels || 0; });

  const lbHist = buildHistoryBySdr(db, rows.map(r => r.id));

  const ranked = rows.map((r, i) => {
    const periodObj = periodObjFromHistory(lbHist, r.id, start, end);
    return {
      ...r,
      rank: i + 1,
      objectif: periodObj,
      ratio: periodObj > 0 ? Math.round((r.rdv_done / periodObj) * 100) : 0,
      total_appels: appelMap[r.id] || 0,
    };
  });

  res.json(ranked);
 } catch (err) { console.error('[GET /api/leaderboard]', err); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ─── Profile ─────────────────────────────────────────────────────────────────

app.put('/api/profile', auth, async (req, res) => {
  const { name, password, new_password } = req.body;
  const db = await getDB();
  const user = dbRow(db, `SELECT id, password_hash FROM users WHERE id=?`, [req.user.id]);

  if (new_password) {
    if (!password) return res.status(400).json({ error: 'Mot de passe actuel requis' });
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    const pwErr2 = validatePassword(new_password);
    if (pwErr2) return res.status(400).json({ error: pwErr2 });
    const hash = await hashPassword(new_password);
    db.run(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.user.id]);
    db.run(`DELETE FROM sessions WHERE user_id=?`, [req.user.id]);
  }

  if (name) db.run(`UPDATE users SET name=? WHERE id=?`, [name, req.user.id]);
  saveDB();

  const updated = dbRow(db, `SELECT id, name, email, role, marche_id, avatar FROM users WHERE id=?`, [req.user.id]);
  res.json({ user: updated });
});

// Tous les badges (page Profil)
app.get('/api/profile/badges', auth, async (req, res) => {
  const db = await getDB();
  const badges = dbRows(db,
    `SELECT id, rank, month, year, rdv_done, awarded_at, seen FROM badges WHERE user_id=? ORDER BY year DESC, month DESC`,
    [req.user.id]);
  res.json(badges);
});

// Notifications uniquement (non dismissed)
app.get('/api/profile/notifications', auth, async (req, res) => {
  const db = await getDB();
  const notifs = dbRows(db,
    `SELECT id, rank, month, year, rdv_done, awarded_at, seen FROM badges WHERE user_id=? AND dismissed=0 ORDER BY year DESC, month DESC`,
    [req.user.id]);
  res.json(notifs);
});

app.put('/api/profile/badges/seen', auth, async (req, res) => {
  const db = await getDB();
  db.run(`UPDATE badges SET seen=1 WHERE user_id=?`, [req.user.id]);
  saveDB();
  res.json({ ok: true });
});

app.put('/api/profile/badges/:id/seen', auth, async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`UPDATE badges SET seen=1 WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
  saveDB();
  res.json({ ok: true });
});

// Dismiss une notif (cache des notifications, badge conservé dans le profil)
app.delete('/api/profile/badges/:id', auth, async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`UPDATE badges SET dismissed=1, seen=1 WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
  saveDB();
  res.json({ ok: true });
});

// ─── Call Logs ───────────────────────────────────────────────────────────────

app.get('/api/admin/call-logs', auth, requireRole('manager', 'admin'), async (req, res) => {
  const db = await getDB();
  const logs = dbRows(db,
    `SELECT cl.sdr_id, cl.semaine, cl.annee, cl.nb_appels, u.name as sdr_name
     FROM call_logs cl JOIN users u ON u.id = cl.sdr_id
     ORDER BY cl.annee DESC, cl.semaine DESC`
  );
  res.json(logs);
});

app.put('/api/admin/call-logs/:sdr_id/:semaine/:annee', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { sdr_id } = req.params;
  if (!isValidUUID(sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });
  const iSemaine = parseInt(req.params.semaine, 10);
  const iAnnee   = parseInt(req.params.annee, 10);
  if (!Number.isInteger(iSemaine) || iSemaine < 1 || iSemaine > 53)
    return res.status(400).json({ error: 'Semaine invalide (1-53)' });
  if (!Number.isInteger(iAnnee) || iAnnee < 2020 || iAnnee > 2099)
    return res.status(400).json({ error: 'Année invalide' });
  const val = Math.max(0, Math.min(parseInt(req.body.nb_appels, 10) || 0, 999));
  const db = await getDB();
  const existing = dbRow(db, `SELECT id FROM call_logs WHERE sdr_id=? AND semaine=? AND annee=?`, [sdr_id, iSemaine, iAnnee]);
  if (existing) {
    db.run(`UPDATE call_logs SET nb_appels=? WHERE sdr_id=? AND semaine=? AND annee=?`, [val, sdr_id, iSemaine, iAnnee]);
  } else {
    db.run(`INSERT INTO call_logs (id, sdr_id, semaine, annee, nb_appels) VALUES (?,?,?,?,?)`,
      [uuidv4(), sdr_id, iSemaine, iAnnee, val]);
  }
  saveDB();
  res.json({ ok: true });
});

app.get('/api/call-logs/me', auth, async (req, res) => {
  const db = await getDB();
  const year = new Date().getFullYear();
  const logs = dbRows(db,
    `SELECT semaine, annee, nb_appels FROM call_logs WHERE sdr_id=? AND annee=? ORDER BY semaine`,
    [req.user.id, year]
  );
  res.json(logs);
});

// Reminders — RDVs en retard, du jour, et à venir (7 jours)
app.get('/api/reminders', auth, async (req, res) => {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const isSdr = req.user.role === 'sdr';
  const params = isSdr ? [nextWeek, req.user.id] : [nextWeek];
  const rows = dbRows(db,
    `SELECT r.id, r.date_prevue, r.sdr_id,
       u.name as sdr_name, m.name as marche_name, m.color as marche_color
     FROM rdvs r
     JOIN users u ON u.id = r.sdr_id
     JOIN marches m ON m.id = r.marche_id
     WHERE r.archived = 0
       AND (r.status = 'pris' OR r.status IS NULL OR r.status = '')
       AND r.date_prevue IS NOT NULL AND r.date_prevue != ''
       AND r.date_prevue <= ?
       ${isSdr ? 'AND r.sdr_id = ?' : ''}
     ORDER BY r.date_prevue`,
    params
  );
  const reminders = rows.map(r => ({
    ...r,
    type: r.date_prevue < today ? 'overdue' : r.date_prevue === today ? 'today' : 'upcoming',
  }));
  res.json(reminders);
});

app.get('/api/profile/rank', auth, async (req, res) => {
  const db = await getDB();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  let rows = dbRows(db,
    `SELECT u.id, u.name, u.avatar,
       COUNT(CASE WHEN r.status='done' THEN 1 END) as done
     FROM users u
     LEFT JOIN rdvs r ON r.sdr_id=u.id AND strftime('%Y-%m', r.date_pris)=?
     WHERE u.role='sdr' AND u.status='active'
     GROUP BY u.id
     ORDER BY done DESC, u.name ASC`,
    [monthKey]);

  const idx = rows.findIndex(r => r.id === req.user.id);
  if (idx === -1) return res.json({ ranked: false, total: rows.length });

  const rank = idx + 1;
  const total = rows.length;
  const current = rows[idx];
  const above = idx > 0 ? { ...rows[idx-1], rank: idx } : null;
  const below = idx < rows.length-1 ? { ...rows[idx+1], rank: idx+2 } : null;

  res.json({ ranked: true, rank, total, current, above, below });
});

app.get('/api/profile/trend', auth, async (req, res) => {
  const db = await getDB();
  const uid = req.user.id;
  const now = new Date();
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][d.getMonth()];
    const row = dbRow(db,
      `SELECT SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
              SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM rdvs WHERE sdr_id=? AND COALESCE(archived,0)=0 AND strftime('%Y-%m', date_pris)=?`,
      [uid, key]);
    months.push({ label, pris: row?.pris||0, done: row?.done||0 });
  }
  res.json(months);
});

app.get('/api/profile/stats', auth, async (req, res) => {
  const db = await getDB();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
  const uid = req.user.id;

  const stats = dbRow(db,
    `SELECT
       SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) as no_show
     FROM rdvs
     WHERE sdr_id=? AND COALESCE(archived,0)=0 AND (
       strftime('%Y-%m', date_pris) = ?
       OR (notes='saisie manuelle' AND annee=?)
     )`,
    [uid, monthKey, year]);

  const obj = dbRow(db, `SELECT objectif_rdv_done FROM objectifs WHERE sdr_id=?`, [uid]);
  const objectif = obj?.objectif_rdv_done ?? null;

  res.json({ pris: stats?.pris||0, done: stats?.done||0, no_show: stats?.no_show||0, objectif, month, year });
});

app.put('/api/profile/avatar', auth, async (req, res) => {
  const { avatar } = req.body;
  // Whitelist de formats matriciels uniquement — pas de SVG (peut contenir du script)
  if (!avatar || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(avatar))
    return res.status(400).json({ error: 'Image invalide (formats acceptés : png, jpeg, webp, gif)' });
  if (avatar.length > 200000) return res.status(400).json({ error: 'Image trop grande (max ~150 Ko)' });
  const db = await getDB();
  db.run(`UPDATE users SET avatar=? WHERE id=?`, [avatar, req.user.id]);
  saveDB();
  const updated = dbRow(db, `SELECT id, name, email, role, marche_id, avatar FROM users WHERE id=?`, [req.user.id]);
  res.json({ user: updated });
});

// ─── Admin: Users ─────────────────────────────────────────────────────────────

app.get('/api/admin/users', auth, requireRole('manager', 'admin'), async (req, res) => {
  const db = await getDB();
  const rows = dbRows(db,
    `SELECT u.id, u.name, u.email, u.role, u.status, u.previous_status, u.marche_id, u.created_at,
       m.name as marche_name, m.color as marche_color,
       COALESCE(o.objectif_rdv_done, 8) as objectif,
       GROUP_CONCAT(um.marche_id) as marche_ids_str
     FROM users u
     LEFT JOIN marches m ON m.id = u.marche_id
     LEFT JOIN objectifs o ON o.sdr_id = u.id
     LEFT JOIN user_marches um ON um.user_id = u.id
     GROUP BY u.id
     ORDER BY u.name`);
  const users = rows.map(u => ({
    ...u,
    marche_ids: u.marche_ids_str ? u.marche_ids_str.split(',') : [],
    marche_ids_str: undefined,
  }));
  res.json(users);
});

app.post('/api/admin/users', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { name, email, role, marche_id, password } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });

  const wantRole = role || 'sdr';
  if (!canAssignRole(req.user.role, wantRole))
    return res.status(403).json({ error: 'Vous ne pouvez pas attribuer ce rôle' });

  const db = await getDB();
  const existing = dbRow(db, `SELECT id FROM users WHERE email=?`, [email.toLowerCase()]);
  if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });

  const id = uuidv4();
  let hash = null;
  let inviteToken = null;
  let inviteExpires = null;

  if (password) {
    const pwErr3 = validatePassword(password);
    if (pwErr3) return res.status(400).json({ error: pwErr3 });
    hash = await hashPassword(password);
  } else {
    inviteToken = uuidv4();
    inviteExpires = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();
  }

  db.run(
    `INSERT INTO users (id, name, email, role, marche_id, password_hash, invite_token, invite_expires, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, name, email.toLowerCase(), wantRole, marche_id || null, hash, inviteToken, inviteExpires, hash ? 'active' : 'pending']
  );
  if (marche_id) {
    db.run(`INSERT OR IGNORE INTO user_marches (user_id, marche_id) VALUES (?,?)`, [id, marche_id]);
  }
  saveDB();

  const user = dbRow(db, `SELECT id, name, email, role, marche_id, status FROM users WHERE id=?`, [id]);

  // if (inviteToken) {
  //   sendInviteEmail(name, email.toLowerCase(), inviteToken).catch(err =>
  //     console.error('[invite email]', err.message)
  //   );
  // }

  res.status(201).json({ user, invite_token: inviteToken });
});

// app.post('/api/admin/users/:id/resend-invite', auth, requireRole('manager', 'admin'), async (req, res) => {
//   try {
//     const db = await getDB();
//     const user = dbRow(db, `SELECT id, name, email, status FROM users WHERE id=?`, [req.params.id]);
//     if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
//     if (user.status !== 'pending') return res.status(400).json({ error: 'Cet utilisateur a déjà activé son compte' });
//     const token = uuidv4();
//     const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();
//     db.run(`UPDATE users SET invite_token=?, invite_expires=? WHERE id=?`, [token, expires, user.id]);
//     saveDB();
//     await sendInviteEmail(user.name, user.email, token);
//     res.json({ ok: true, invite_token: token });
//   } catch (err) {
//     console.error('[resend-invite]', err);
//     res.status(500).json({ error: err.message || 'Erreur envoi email' });
//   }
// });

app.put('/api/admin/users/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { name, email, role, marche_id, status } = req.body;
  const db = await getDB();
  const current = dbRow(db, `SELECT status, role FROM users WHERE id=?`, [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Utilisateur introuvable' });

  if (status != null && !['active', 'pending', 'disabled'].includes(status))
    return res.status(400).json({ error: 'Statut invalide' });

  if (email) {
    const dup = dbRow(db, `SELECT id FROM users WHERE email=? AND id!=?`, [email.toLowerCase(), req.params.id]);
    if (dup) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
  }

  // Un manager ne peut pas modifier un compte admin (anti-prise de contrôle)
  if (req.user.role !== 'admin' && current.role === 'admin')
    return res.status(403).json({ error: 'Accès refusé' });

  // Changement de rôle : valider selon les droits de l'appelant
  if (role != null && role !== current.role && !canAssignRole(req.user.role, role))
    return res.status(403).json({ error: 'Vous ne pouvez pas attribuer ce rôle' });

  // Ne jamais verrouiller le dernier admin (rétrogradation ou désactivation)
  const demotingAdmin = current.role === 'admin' && ((role != null && role !== 'admin') || status === 'disabled');
  if (demotingAdmin && countActiveAdmins(db, req.params.id) === 0)
    return res.status(400).json({ error: 'Impossible : ce serait le dernier administrateur actif' });

  // Le marché par défaut (marche_id) peut être null (désaffecté) — COALESCE l'ignorerait, on le gère à part.
  // Les affectations (user_marches) ne sont PAS modifiées ici : elles se gèrent dans l'onglet Marchés.
  if ('marche_id' in req.body) {
    db.run(`UPDATE users SET marche_id=? WHERE id=?`, [marche_id ?? null, req.params.id]);
  }

  // Mémoriser l'état précédent uniquement quand on désactive
  const savePrev = status === 'disabled' && current?.status !== 'disabled';
  if (savePrev) {
    db.run(
      `UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role), status=COALESCE(?,status), previous_status=? WHERE id=?`,
      [name ?? null, email?.toLowerCase() ?? null, role ?? null, status ?? null, current.status, req.params.id]
    );
  } else {
    db.run(
      `UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role), status=COALESCE(?,status) WHERE id=?`,
      [name ?? null, email?.toLowerCase() ?? null, role ?? null, status ?? null, req.params.id]
    );
  }
  saveDB();
  const user = dbRow(db, `SELECT id, name, email, role, marche_id, status, previous_status FROM users WHERE id=?`, [req.params.id]);
  res.json(user);
});

app.put('/api/admin/users/:id/reset-password', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { password } = req.body;
  const pwErr4 = validatePassword(password);
  if (pwErr4) return res.status(400).json({ error: pwErr4 });
  const db = await getDB();
  const target = dbRow(db, `SELECT id, role FROM users WHERE id=?`, [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (target.role === 'admin' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Seul un admin peut réinitialiser le mot de passe d\'un admin.' });
  const hash = await hashPassword(password);
  db.run(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.params.id]);
  db.run(`DELETE FROM sessions WHERE user_id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// ─── Saisie manuelle de RDVs (admin/manager) ────────────────────────────────
// GET — CRM + manuel par SDR/semaine/année
app.get('/api/admin/rdvs/manual', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const db = await getDB();
    const rows = dbRows(db,
      `SELECT
         sdr_id, semaine, annee,
         MAX(CASE WHEN notes='saisie manuelle' THEN marche_id ELSE NULL END) as marche_id,
         MAX(CASE WHEN notes!='saisie manuelle' AND crm_url_pris IS NOT NULL THEN marche_id ELSE NULL END) as crm_marche_id,
         SUM(CASE WHEN crm_url_pris IS NOT NULL AND COALESCE(archived,0)=0 THEN 1 ELSE 0 END) as crm_pris,
         SUM(CASE WHEN status='done' AND crm_url_pris IS NOT NULL AND COALESCE(archived,0)=0 THEN 1 ELSE 0 END) as crm_done,
         SUM(CASE WHEN notes='saisie manuelle' AND status='pris' THEN 1 ELSE 0 END) as manual_pris,
         SUM(CASE WHEN notes='saisie manuelle' AND status='done' THEN 1 ELSE 0 END) as manual_done
       FROM rdvs
       WHERE semaine IS NOT NULL AND annee IS NOT NULL
       GROUP BY sdr_id, semaine, annee`, []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT — reçoit le TOTAL voulu (CRM + manuel) ; stocke seulement le delta manuel
app.put('/api/admin/rdvs/manual/:sdrId/:week/:year', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { sdrId } = req.params;
    if (!isValidUUID(sdrId)) return res.status(400).json({ error: 'ID SDR invalide' });
    const iWeek = parseInt(req.params.week, 10);
    const iYear = parseInt(req.params.year, 10);
    const { marche_id, pris = 0, done = 0 } = req.body;

    if (!Number.isInteger(iWeek) || iWeek < 1 || iWeek > 53)
      return res.status(400).json({ error: 'Semaine invalide (1-53)' });
    if (!Number.isInteger(iYear) || iYear < 2020 || iYear > 2099)
      return res.status(400).json({ error: 'Année invalide' });
    if (!marche_id || !isValidId(marche_id))
      return res.status(400).json({ error: 'marche_id invalide' });

    const totalPris = Math.max(0, Math.min(parseInt(pris, 10) || 0, 999));
    const totalDone = Math.max(0, Math.min(parseInt(done, 10) || 0, 999));

    const db = await getDB();

    const targetUser = dbRow(db, `SELECT id, role FROM users WHERE id=?`, [sdrId]);
    if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (targetUser.role !== 'sdr') return res.status(403).json({ error: 'Cible doit être un SDR' });

    const targetMarche = dbRow(db, `SELECT id FROM marches WHERE id=? AND archived=0`, [marche_id]);
    if (!targetMarche) return res.status(400).json({ error: 'Marché introuvable ou archivé' });

    // Compter les RDVs CRM non-archivés existants pour ce SDR/semaine/année
    const crm = dbRow(db,
      `SELECT
         SUM(CASE WHEN crm_url_pris IS NOT NULL AND COALESCE(archived,0)=0 THEN 1 ELSE 0 END) as crm_pris,
         SUM(CASE WHEN status='done' AND crm_url_pris IS NOT NULL AND COALESCE(archived,0)=0 THEN 1 ELSE 0 END) as crm_done
       FROM rdvs WHERE sdr_id=? AND semaine=? AND annee=?`,
      [sdrId, iWeek, iYear]
    ) || {};
    const crmPris = crm.crm_pris || 0;
    const crmDone = crm.crm_done || 0;

    // Refus si l'admin essaie de descendre sous les RDVs CRM déjà soumis
    if (totalPris < crmPris)
      return res.status(400).json({ error: `Impossible de descendre sous ${crmPris} RDV pris (soumis par le SDR avec URL CRM). Archivez ou supprimez d'abord.` });
    if (totalDone < crmDone)
      return res.status(400).json({ error: `Impossible de descendre sous ${crmDone} RDV done (soumis par le SDR avec URL CRM). Archivez ou supprimez d'abord.` });

    const manualPris = totalPris - crmPris;
    const manualDone = totalDone - crmDone;

    // Date de référence = lundi de la semaine ISO
    const jan4 = new Date(Date.UTC(iYear, 0, 4));
    const day  = jan4.getUTCDay() || 7;
    const mon  = new Date(Date.UTC(jan4.getUTCFullYear(), 0, jan4.getUTCDate() - (day - 1)));
    mon.setUTCDate(mon.getUTCDate() + (iWeek - 1) * 7);
    const dateRef = mon.toISOString().split('T')[0];

    db.run(`DELETE FROM rdvs WHERE sdr_id=? AND semaine=? AND annee=? AND notes='saisie manuelle'`,
      [sdrId, iWeek, iYear]);
    db.run(`UPDATE users SET marche_id=? WHERE id=?`, [marche_id, sdrId]);
    db.run(`INSERT OR IGNORE INTO user_marches (user_id, marche_id) VALUES (?,?)`, [sdrId, marche_id]);
    for (let i = 0; i < manualDone; i++) {
      db.run(`INSERT INTO rdvs (id,sdr_id,marche_id,semaine,annee,status,notes,date_pris,date_done,archived)
              VALUES (?,?,?,?,?,'done','saisie manuelle',?,?,0)`,
        [uuidv4(), sdrId, marche_id, iWeek, iYear, dateRef, dateRef]);
    }
    for (let i = 0; i < manualPris; i++) {
      db.run(`INSERT INTO rdvs (id,sdr_id,marche_id,semaine,annee,status,notes,date_pris,archived)
              VALUES (?,?,?,?,?,'pris','saisie manuelle',?,0)`,
        [uuidv4(), sdrId, marche_id, iWeek, iYear, dateRef]);
    }
    saveDB();
    res.json({ ok: true, total_pris: totalPris, total_done: totalDone, manual_pris: manualPris, manual_done: manualDone });
  } catch (err) {
    console.error('[PUT /api/admin/rdvs/manual]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/admin/users/:id', auth, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
  const db = await getDB();
  const user = dbRow(db, `SELECT status FROM users WHERE id=?`, [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.status !== 'disabled') return res.status(400).json({ error: 'Désactivez d\'abord l\'utilisateur avant de le supprimer définitivement' });
  const uid = req.params.id;
  db.run(`DELETE FROM users          WHERE id=?`,      [uid]);
  db.run(`DELETE FROM sessions       WHERE user_id=?`, [uid]);
  db.run(`DELETE FROM rdvs           WHERE sdr_id=?`,  [uid]);
  db.run(`DELETE FROM badges         WHERE user_id=?`, [uid]);
  db.run(`DELETE FROM call_logs      WHERE sdr_id=?`,  [uid]);
  db.run(`DELETE FROM objectifs      WHERE sdr_id=?`,  [uid]);
  db.run(`DELETE FROM objectif_history WHERE sdr_id=?`,[uid]);
  db.run(`DELETE FROM call_issues    WHERE sdr_id=?`,  [uid]);
  db.run(`DELETE FROM user_marches   WHERE user_id=?`, [uid]);
  saveDB();
  res.json({ ok: true });
});

// Assigner un utilisateur à un marché
app.post('/api/admin/users/:id/marches/:marche_id', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { id, marche_id } = req.params;
  if (!isValidUUID(id) || !isValidId(marche_id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`INSERT OR IGNORE INTO user_marches (user_id, marche_id) VALUES (?,?)`, [id, marche_id]);
  // Définir comme marché primaire si l'utilisateur n'en a pas encore
  db.run(`UPDATE users SET marche_id=? WHERE id=? AND marche_id IS NULL`, [marche_id, id]);
  saveDB();
  const marche_ids = dbRows(db, `SELECT marche_id FROM user_marches WHERE user_id=?`, [id]).map(r => r.marche_id);
  res.json({ ok: true, marche_ids });
});

// Retirer un utilisateur d'un marché
app.delete('/api/admin/users/:id/marches/:marche_id', auth, requireRole('manager', 'admin'), async (req, res) => {
  const { id, marche_id } = req.params;
  if (!isValidUUID(id) || !isValidId(marche_id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`DELETE FROM user_marches WHERE user_id=? AND marche_id=?`, [id, marche_id]);
  // Si c'était le marché primaire, mettre à jour vers un autre marché ou null
  const user = dbRow(db, `SELECT marche_id FROM users WHERE id=?`, [id]);
  if (user?.marche_id === marche_id) {
    const next = dbRow(db, `SELECT marche_id FROM user_marches WHERE user_id=? LIMIT 1`, [id]);
    db.run(`UPDATE users SET marche_id=? WHERE id=?`, [next?.marche_id ?? null, id]);
  }
  saveDB();
  const marche_ids = dbRows(db, `SELECT marche_id FROM user_marches WHERE user_id=?`, [id]).map(r => r.marche_id);
  res.json({ ok: true, marche_ids });
});

// ─── Admin: Marchés ──────────────────────────────────────────────────────────

app.get('/api/admin/marches', auth, requireRole('manager', 'admin'), async (req, res) => {
  const db = await getDB();
  res.json(dbRows(db, `SELECT * FROM marches ORDER BY archived, position, name`));
});

app.post('/api/admin/marches', auth, requireRole('admin'), async (req, res) => {
  const { name, code, color } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Nom et code requis' });
  if (typeof code !== 'string' || code.length > 10) return res.status(400).json({ error: 'Code trop long (max 10 caractères)' });
  const db = await getDB();
  const maxPos = dbRow(db, `SELECT MAX(position) as p FROM marches`)?.p ?? 0;
  const id = uuidv4();
  db.run(`INSERT INTO marches VALUES (?,?,?,?,?)`, [id, name, code.toUpperCase(), color || '#3b82f6', maxPos + 1]);
  saveDB();
  res.status(201).json(dbRow(db, `SELECT * FROM marches WHERE id=?`, [id]));
});

app.put('/api/admin/marches/:id', auth, requireRole('admin'), async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const { name, code, color, position } = req.body;
  const db = await getDB();
  db.run(
    `UPDATE marches SET name=COALESCE(?,name), code=COALESCE(?,code), color=COALESCE(?,color), position=COALESCE(?,position) WHERE id=?`,
    [name, code, color, position, req.params.id]
  );
  saveDB();
  res.json(dbRow(db, `SELECT * FROM marches WHERE id=?`, [req.params.id]));
});

app.patch('/api/admin/marches/:id/archive', auth, requireRole('admin'), async (req, res) => {
  const db = await getDB();
  const marche = dbRow(db, `SELECT * FROM marches WHERE id=?`, [req.params.id]);
  if (!marche) return res.status(404).json({ error: 'Marché introuvable' });
  const unassigned = dbRows(db, `SELECT id, name FROM users WHERE marche_id=?`, [req.params.id]);
  db.run(`UPDATE users SET marche_id=NULL WHERE marche_id=?`, [req.params.id]);
  db.run(`UPDATE marches SET archived=1 WHERE id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true, unassigned });
});

app.patch('/api/admin/marches/:id/unarchive', auth, requireRole('admin'), async (req, res) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'ID invalide' });
  const db = await getDB();
  db.run(`UPDATE marches SET archived=0 WHERE id=?`, [req.params.id]);
  saveDB();
  res.json(dbRow(db, `SELECT * FROM marches WHERE id=?`, [req.params.id]));
});

app.delete('/api/admin/marches/:id', auth, requireRole('admin'), async (req, res) => {
  const db = await getDB();
  const count = dbRow(db, `SELECT COUNT(*) as c FROM rdvs WHERE marche_id=?`, [req.params.id])?.c;
  if (count > 0) return res.status(400).json({ error: 'Ce marché a des RDVs associés' });
  db.run(`DELETE FROM marches WHERE id=?`, [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// ─── Admin: Objectifs ─────────────────────────────────────────────────────────

app.get('/api/admin/objectifs', auth, requireRole('manager', 'admin'), async (req, res) => {
  const db = await getDB();
  const rows = dbRows(db,
    `SELECT u.id as sdr_id, u.name, u.email, m.name as marche_name,
       COALESCE(o.objectif_rdv_done, 8) as objectif_rdv_done
     FROM users u
     LEFT JOIN marches m ON m.id = u.marche_id
     LEFT JOIN objectifs o ON o.sdr_id = u.id
     WHERE u.role='sdr' AND u.status='active'
     ORDER BY m.name, u.name`);
  res.json(rows);
});

app.put('/api/admin/objectifs/:sdr_id', auth, requireRole('manager', 'admin'), async (req, res) => {
  if (!isValidUUID(req.params.sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });
  const { objectif_rdv_done } = req.body;
  if (objectif_rdv_done === undefined) return res.status(400).json({ error: 'Objectif requis' });
  const val = Math.max(1, Math.min(500, parseInt(objectif_rdv_done, 10) || 1));
  const db = await getDB();
  db.run(
    `INSERT INTO objectifs (id, sdr_id, objectif_rdv_done) VALUES (?,?,?)
     ON CONFLICT(sdr_id) DO UPDATE SET objectif_rdv_done=excluded.objectif_rdv_done`,
    [uuidv4(), req.params.sdr_id, val]
  );
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  db.run(
    `INSERT INTO objectif_history (id, sdr_id, objectif, effective_from)
     VALUES (?,?,?,?)
     ON CONFLICT(sdr_id, effective_from) DO UPDATE SET objectif=excluded.objectif`,
    [uuidv4(), req.params.sdr_id, val, ym]
  );
  saveDB();
  res.json({ ok: true });
});

// ─── Performance ──────────────────────────────────────────────────────────────

app.get('/api/admin/performance', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const db = await getDB();
    const VALID_PERIODS = ['week', 'month', 'year'];
    const period = VALID_PERIODS.includes(req.query.period) ? req.query.period : 'month';
    const sdr_id = req.query.sdr_id || null;
    if (sdr_id && !isValidUUID(sdr_id)) return res.status(400).json({ error: 'ID SDR invalide' });
    const yearInt = parseInt(req.query.year, 10) || new Date().getFullYear();
    if (yearInt < 2020 || yearInt > 2099) return res.status(400).json({ error: 'Année invalide' });
    const year = String(yearInt);

    const sdrParam = sdr_id ? [sdr_id] : [];
    const sdrCond  = sdr_id ? 'AND sdr_id = ?' : '';
    let rows;

    if (period === 'week') {
      rows = dbRows(db, `
        SELECT semaine as label,
               SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
               SUM(CASE WHEN status='done'    THEN 1 ELSE 0 END) as done,
               SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) as no_show
        FROM rdvs
        WHERE archived=0 AND annee=? ${sdrCond}
        GROUP BY semaine ORDER BY semaine
      `, [yearInt, ...sdrParam]);

    } else {
      // Mois ou Année : pris par date_pris, done par date_done (comme Synthesis)
      const yearCond     = period === 'year' ? '' : 'AND strftime(\'%Y\', date_pris)=?';
      const yearCondDone = period === 'year' ? '' : 'AND strftime(\'%Y\', date_done)=?';
      const groupFn     = period === 'year' ? `strftime('%Y', date_pris)` : `strftime('%m', date_pris)`;
      const groupFnDone = period === 'year' ? `strftime('%Y', date_done)` : `strftime('%m', date_done)`;

      const prisParams  = period === 'year' ? [...sdrParam] : [year, ...sdrParam];
      const doneParams  = period === 'year' ? [...sdrParam] : [year, ...sdrParam];

      const prisList = dbRows(db, `
        SELECT ${groupFn} as label,
               SUM(CASE WHEN (crm_url_pris IS NOT NULL OR notes='saisie manuelle') THEN 1 ELSE 0 END) as pris,
               SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) as no_show
        FROM rdvs
        WHERE date_pris IS NOT NULL AND archived=0 ${yearCond} ${sdrCond}
        GROUP BY label ORDER BY label
      `, prisParams);

      const doneList = dbRows(db, `
        SELECT ${groupFnDone} as label,
               SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
        FROM rdvs
        WHERE date_done IS NOT NULL AND archived=0 ${yearCondDone} ${sdrCond}
        GROUP BY label ORDER BY label
      `, doneParams);

      const map = {};
      prisList.forEach(r => { map[r.label] = { label: r.label, pris: r.pris||0, no_show: r.no_show||0, done: 0 }; });
      doneList.forEach(r => {
        if (!map[r.label]) map[r.label] = { label: r.label, pris: 0, no_show: 0, done: 0 };
        map[r.label].done = r.done || 0;
      });
      rows = Object.values(map).sort((a,b) => a.label.localeCompare(b.label));
    }

    // Appels (call_logs) — fusionner par la même granularité
    let appelList;
    if (period === 'week') {
      appelList = dbRows(db, `
        SELECT semaine as label, SUM(nb_appels) as appels
        FROM call_logs WHERE annee=? ${sdrCond}
        GROUP BY semaine ORDER BY semaine
      `, [yearInt, ...sdrParam]);
    } else if (period === 'month') {
      appelList = dbRows(db, `
        SELECT strftime('%m', date(
          date(CAST(annee AS TEXT) || '-01-04',
               CAST(-((CAST(strftime('%w', CAST(annee AS TEXT) || '-01-04') AS INTEGER) + 6) % 7) AS TEXT) || ' days'),
          CAST((semaine - 1) * 7 AS TEXT) || ' days'
        )) as label,
        SUM(nb_appels) as appels
        FROM call_logs WHERE annee=? ${sdrCond}
        GROUP BY label ORDER BY label
      `, [yearInt, ...sdrParam]);
    } else {
      appelList = dbRows(db, `
        SELECT CAST(annee AS TEXT) as label, SUM(nb_appels) as appels
        FROM call_logs ${sdr_id ? 'WHERE sdr_id=?' : ''}
        GROUP BY annee ORDER BY annee
      `, sdrParam);
    }
    const appelMap = {};
    appelList.forEach(r => { appelMap[String(r.label)] = r.appels || 0; });
    rows = rows.map(r => ({ ...r, appels: appelMap[String(r.label)] || 0 }));
    // Ajouter les semaines/mois avec appels mais sans rdv
    const rdvLabels = new Set(rows.map(r => String(r.label)));
    appelList.forEach(r => {
      if (!rdvLabels.has(String(r.label)))
        rows.push({ label: r.label, pris: 0, done: 0, no_show: 0, appels: r.appels || 0 });
    });
    rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    // ── Objectif par période (cohérent semaine / mois / année) ───────────────
    function weekToYM(w, y) {
      const jan4 = new Date(parseInt(y), 0, 4);
      const dow = (jan4.getDay() + 6) % 7; // 0=lun, 6=dim
      const w1Mon = new Date(jan4.getTime() - dow * 86400000);
      const wMon  = new Date(w1Mon.getTime() + (parseInt(w) - 1) * 7 * 86400000);
      return `${wMon.getFullYear()}-${String(wMon.getMonth() + 1).padStart(2, '0')}`;
    }

    let history = [];
    let activeSdrList = [];
    let fallbackObjMap = {};
    if (sdr_id) {
      history = dbRows(db,
        `SELECT sdr_id, objectif, effective_from FROM objectif_history WHERE sdr_id=? ORDER BY effective_from ASC`,
        [sdr_id]);
      const cur = dbRow(db, `SELECT objectif_rdv_done FROM objectifs WHERE sdr_id=?`, [sdr_id]);
      if (cur) fallbackObjMap[sdr_id] = cur.objectif_rdv_done;
    } else {
      activeSdrList = dbRows(db, `SELECT id FROM users WHERE role='sdr' AND status='active'`);
      if (activeSdrList.length > 0) {
        const ph = activeSdrList.map(() => '?').join(',');
        const ids = activeSdrList.map(s => s.id);
        history = dbRows(db,
          `SELECT sdr_id, objectif, effective_from FROM objectif_history WHERE sdr_id IN (${ph}) ORDER BY effective_from ASC`,
          ids);
        dbRows(db, `SELECT sdr_id, objectif_rdv_done FROM objectifs WHERE sdr_id IN (${ph})`, ids)
          .forEach(o => { fallbackObjMap[o.sdr_id] = o.objectif_rdv_done; });
      }
    }

    function getObjSdr(sid, ym) {
      const entries = history.filter(h => h.sdr_id === sid && h.effective_from <= ym);
      if (entries.length > 0) return entries[entries.length - 1].objectif;
      return fallbackObjMap[sid] ?? 8;
    }

    function getObjPeriod(ym) {
      if (sdr_id) return getObjSdr(sdr_id, ym);
      return activeSdrList.reduce((s, x) => s + getObjSdr(x.id, ym), 0);
    }

    rows = rows.map(r => {
      let obj;
      if (period === 'week') {
        obj = Math.ceil(getObjPeriod(weekToYM(r.label, year)) / 4);
      } else if (period === 'month') {
        obj = getObjPeriod(`${year}-${String(r.label).padStart(2, '0')}`);
      } else {
        let total = 0;
        for (let m = 1; m <= 12; m++)
          total += getObjPeriod(`${r.label}-${String(m).padStart(2, '0')}`);
        obj = total;
      }
      return { ...r, objectif: obj };
    });

    // Objectif mensuel courant (rétrocompatibilité frontend)
    let objectif = null;
    if (sdr_id) {
      const obj = dbRow(db, `SELECT objectif_rdv_done FROM objectifs WHERE sdr_id=?`, [sdr_id]);
      objectif = obj?.objectif_rdv_done ?? 8;
    } else {
      const obj = dbRow(db, `SELECT SUM(o.objectif_rdv_done) as total FROM objectifs o JOIN users u ON u.id=o.sdr_id WHERE u.status='active' AND u.role='sdr'`);
      objectif = obj?.total ?? null;
    }

    res.json({ rows, objectif });
  } catch (err) {
    console.error('[GET /api/admin/performance]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

const PUBLIC_SETTINGS = new Set(['leaderboard_period_filter', 'app_name']);

app.get('/api/settings', auth, async (req, res) => {
  const db = await getDB();
  const rows = dbRows(db, `SELECT key, value FROM settings`);
  const all = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (req.user.role === 'sdr') {
    return res.json(Object.fromEntries(Object.entries(all).filter(([k]) => PUBLIC_SETTINGS.has(k))));
  }
  res.json(all);
});

const ALLOWED_SETTINGS = new Set(['leaderboard_period_filter']);

app.put('/api/admin/settings', auth, requireRole('admin'), async (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Corps invalide' });
  const db = await getDB();
  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_SETTINGS.has(key)) continue;
    const safeVal = value === '1' ? '1' : '0';
    db.run(`INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, safeVal]);
  }
  saveDB();
  res.json({ ok: true });
});

// ─── Sécurité : IPs bloquées + événements ────────────────────────────────────

app.get('/api/admin/security', auth, requireRole('admin'), async (req, res) => {
  const db = await getDB();
  const now = Date.now();

  const rawBlocked = dbRows(db,
    `SELECT key, hits, reset_time FROM rate_limits WHERE reset_time > ? ORDER BY hits DESC, reset_time DESC`,
    [now]
  );
  const blocked = rawBlocked.map(r => {
    let type, ip, email = null;
    if (r.key.startsWith('ip|')) {
      type = 'login_global'; ip = r.key.slice(3);
    } else if (r.key.startsWith('invite|')) {
      type = 'invite'; ip = r.key.slice(7);
    } else {
      const sep = r.key.indexOf('|');
      type = 'login_email';
      ip   = sep > 0 ? r.key.slice(0, sep) : r.key;
      email = sep > 0 ? r.key.slice(sep + 1) : null;
    }
    const maxHits = type === 'login_global' ? 20 : type === 'invite' ? 5 : 10;
    return { ...r, reset_time: Number(r.reset_time), hits: Number(r.hits), max: maxHits, blocked: Number(r.hits) >= maxHits, type, ip, email };
  });

  const events = dbRows(db,
    `SELECT e.id, e.type, e.ip, e.user_id, e.email, e.detail, e.created_at, u.name as user_name
     FROM security_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.created_at DESC LIMIT 100`
  );

  res.json({ blocked, events });
});

app.delete('/api/admin/security/unblock', auth, requireRole('admin'), async (req, res) => {
  const { ip } = req.body;
  if (!ip || typeof ip !== 'string' || ip.length > 64 || !/^[\d.a-f:]+$/i.test(ip))
    return res.status(400).json({ error: 'IP invalide' });
  const db = await getDB();
  const before = dbRows(db,
    `SELECT key FROM rate_limits WHERE key = ? OR key = ? OR key GLOB ?`,
    [`ip|${ip}`, `invite|${ip}`, `${ip}|*`]
  );
  db.run(`DELETE FROM rate_limits WHERE key = ? OR key = ? OR key GLOB ?`,
    [`ip|${ip}`, `invite|${ip}`, `${ip}|*`]);
  saveDB();
  await logSecurityEvent('ip_unblocked', req.ip, req.user.id, null, `IP débloquée : ${ip}`);
  res.json({ ok: true, removed: before.length });
});

app.delete('/api/admin/security/events', auth, requireRole('admin'), async (req, res) => {
  const { ids } = req.body;
  const db = await getDB();
  if (Array.isArray(ids) && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM security_events WHERE id IN (${placeholders})`, ids);
  } else {
    db.run(`DELETE FROM security_events`);
  }
  saveDB();
  res.json({ ok: true });
});

// ─── Admin: Create default admin on first run ─────────────────────────────────

async function ensureDefaultAdmin() {
  const db = await getDB();
  const adminExists = dbRow(db, `SELECT id FROM users WHERE role='admin' LIMIT 1`);
  if (adminExists) return;

  const email = (process.env.ADMIN_INITIAL_EMAIL || 'admin@captivea.com').toLowerCase().trim();
  // Pas de mot de passe en dur : on prend ADMIN_INITIAL_PASSWORD, sinon on en génère un aléatoire.
  const provided = process.env.ADMIN_INITIAL_PASSWORD;
  const password = provided || randomBytes(18).toString('base64url');
  const hash = await hashPassword(password);
  const id = uuidv4();
  db.run(
    `INSERT INTO users (id, name, email, role, password_hash, status) VALUES (?,?,?,?,?,?)`,
    [id, 'Admin', email, 'admin', hash, 'active']
  );
  saveDB();
  if (provided) {
    console.log(`Default admin created: ${email} (mot de passe fourni via ADMIN_INITIAL_PASSWORD)`);
  } else {
    console.log('═'.repeat(64));
    console.log('  ADMIN INITIAL CRÉÉ — notez ce mot de passe, affiché UNE SEULE FOIS :');
    console.log(`    email    : ${email}`);
    console.log(`    password : ${password}`);
    console.log('  Changez-le après la première connexion.');
    console.log('═'.repeat(64));
  }
}

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

process.on('uncaughtException', err => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', reason => console.error('[UNHANDLED REJECTION]', reason));

// ─── SPA fallback ─────────────────────────────────────────────────────────────

if (fs.existsSync(DIST)) {
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function fixISOWeeks() {
  const db = await getDB();
  const done = dbRow(db, `SELECT value FROM settings WHERE key='iso_weeks_fixed'`);
  if (done?.value === '1') return;
  const rdvs = dbRows(db, `SELECT id, date_pris, date_done FROM rdvs WHERE date_pris IS NOT NULL OR date_done IS NOT NULL`);
  let fixed = 0;
  rdvs.forEach(r => {
    const ref = r.date_pris || r.date_done;
    const semaine = getISOWeek(new Date(ref));
    const annee   = getISOYear(new Date(ref));
    db.run(`UPDATE rdvs SET semaine=?, annee=? WHERE id=?`, [semaine, annee, r.id]);
    fixed++;
  });
  db.run(`INSERT OR REPLACE INTO settings VALUES ('iso_weeks_fixed', '1')`);
  saveDB();
  if (fixed > 0) console.log(`[fixISOWeeks] ${fixed} RDVs recalculés`);
}

// Garantit que le marché par défaut de chaque utilisateur fait partie de ses
// marchés affectés. Corrige les défauts orphelins (séquelles d'anciens modals).
// Idempotent : ne touche que les cas incohérents.
async function reconcileDefaultMarches() {
  const db = await getDB();
  const users = dbRows(db, `SELECT id, name, marche_id FROM users WHERE marche_id IS NOT NULL`);
  const allAssigns = dbRows(db,
    `SELECT um.user_id, um.marche_id, m.archived FROM user_marches um JOIN marches m ON m.id = um.marche_id`);
  const assignsByUser = {};
  allAssigns.forEach(a => {
    if (!assignsByUser[a.user_id]) assignsByUser[a.user_id] = [];
    assignsByUser[a.user_id].push(a);
  });
  let fixed = 0;
  users.forEach(u => {
    const assigns = assignsByUser[u.id] || [];
    if (assigns.length === 0) {
      // Défaut sans aucune affectation → le défaut devient l'affectation.
      db.run(`INSERT OR IGNORE INTO user_marches (user_id, marche_id) VALUES (?,?)`, [u.id, u.marche_id]);
      return;
    }
    if (assigns.some(a => a.marche_id === u.marche_id)) return; // déjà cohérent
    // Défaut hors affectations → on prend une affectation valide (non archivée de préférence).
    const pick = (assigns.find(a => !a.archived) || assigns[0]).marche_id;
    db.run(`UPDATE users SET marche_id=? WHERE id=?`, [pick, u.id]);
    console.log(`[reconcileMarche] ${u.name}: défaut '${u.marche_id}' → '${pick}'`);
    fixed++;
  });
  if (fixed > 0) { saveDB(); console.log(`[reconcileMarche] ${fixed} marché(s) par défaut corrigé(s)`); }
}

async function awardMonthlyBadges() {
  const db = await getDB();
  const now = new Date();
  // Mois précédent
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevKey   = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  const lastKey = dbRow(db, `SELECT value FROM settings WHERE key='last_badge_month'`)?.value || '';
  if (lastKey === prevKey) return; // déjà traité

  const monthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const top3 = dbRows(db, `
    SELECT u.id, u.name,
      SUM(CASE WHEN r.status='done' AND (COALESCE(r.archived,0)=0 OR r.archived IS NULL)
               AND strftime('%Y-%m', r.date_done) = ? THEN 1 ELSE 0 END) as rdv_done
    FROM users u
    LEFT JOIN rdvs r ON r.sdr_id = u.id
    WHERE u.role='sdr' AND u.status='active'
    GROUP BY u.id
    HAVING rdv_done > 0
    ORDER BY rdv_done DESC
    LIMIT 3
  `, [monthStr]);

  if (top3.length === 0) {
    console.log(`[badges] Aucun RDV done en ${monthStr}, pas de badges attribués.`);
  } else {
    top3.forEach((sdr, i) => {
      const id = uuidv4();
      db.run(
        `INSERT OR IGNORE INTO badges (id, user_id, rank, month, year, rdv_done) VALUES (?,?,?,?,?,?)`,
        [id, sdr.id, i + 1, prevMonth, prevYear, sdr.rdv_done]
      );
      console.log(`[badges] #${i + 1} → ${sdr.name} (${sdr.rdv_done} done) — ${monthStr}`);
    });
  }
  db.run(`INSERT OR REPLACE INTO settings VALUES ('last_badge_month', ?)`, [prevKey]);
  saveDB();
}

getDB().then(async () => {
  await fixISOWeeks();
  await reconcileDefaultMarches();
  await awardMonthlyBadges();
  await ensureDefaultAdmin();
  app.listen(PORT, () => console.log(`Batonnage server running on port ${PORT}`));
});
