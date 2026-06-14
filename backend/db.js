const path = require('path');
const fs = require('fs');

let db;

async function getDB() {
  if (db) return db;

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const DB_PATH = path.join(DATA_DIR, 'batonnage.db');

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  migrate(db);
  saveDB();

  return db;
}

function saveDB() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
  const DB_PATH = path.join(DATA_DIR, 'batonnage.db');
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function migrate(db) {
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER, applied_at TEXT)`);
  const res = db.exec(`SELECT MAX(version) as v FROM schema_version`);
  const current = res[0]?.values[0]?.[0] || 0;

  const migrations = [
    // v1: core tables
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'sdr',
      marche_id TEXT,
      password_hash TEXT,
      status TEXT DEFAULT 'active',
      invite_token TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      role TEXT,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS marches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      position INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rdvs (
      id TEXT PRIMARY KEY,
      sdr_id TEXT NOT NULL,
      marche_id TEXT NOT NULL,
      semaine INTEGER NOT NULL,
      annee INTEGER NOT NULL,
      crm_url_pris TEXT,
      date_pris TEXT,
      date_prevue TEXT,
      crm_url_done TEXT,
      date_done TEXT,
      status TEXT DEFAULT 'pris',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS objectifs (
      id TEXT PRIMARY KEY,
      sdr_id TEXT NOT NULL UNIQUE,
      objectif_rdv_done INTEGER DEFAULT 8
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT OR IGNORE INTO settings VALUES ('theme', 'batonnage');
    INSERT OR IGNORE INTO settings VALUES ('app_name', 'Batonnage');`,

    // v2: champ archived sur rdvs
    `ALTER TABLE rdvs ADD COLUMN archived INTEGER DEFAULT 0;`,

    // v3: previous_status sur users (pour mémoriser l'état avant désactivation)
    `ALTER TABLE users ADD COLUMN previous_status TEXT;`,

    // v4: archived column on marchés
    `ALTER TABLE marches ADD COLUMN archived INTEGER DEFAULT 0;`,

    // v5: avatar on users + leaderboard period filter setting
    `ALTER TABLE users ADD COLUMN avatar TEXT;
     INSERT OR IGNORE INTO settings VALUES ('leaderboard_period_filter', '0');`,

    // v6: badges mensuels
    `CREATE TABLE IF NOT EXISTS badges (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       rank INTEGER NOT NULL,
       month INTEGER NOT NULL,
       year INTEGER NOT NULL,
       rdv_done INTEGER DEFAULT 0,
       awarded_at TEXT DEFAULT (datetime('now')),
       UNIQUE(user_id, month, year)
     );
     INSERT OR IGNORE INTO settings VALUES ('last_badge_month', '');`,

    // v7: seen flag sur badges
    `ALTER TABLE badges ADD COLUMN seen INTEGER DEFAULT 0;`,

    // v8: dismissed flag — cache la notif sans supprimer le badge
    `ALTER TABLE badges ADD COLUMN dismissed INTEGER DEFAULT 0;`,

    // v9: problèmes d'appel
    `CREATE TABLE IF NOT EXISTS call_issues (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL,
       marche_id TEXT,
       issue_type TEXT NOT NULL,
       date TEXT,
       notes TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     );`,

    // v10: catégories de problèmes d'appel (dynamiques)
    `CREATE TABLE IF NOT EXISTS call_issue_types (
       id TEXT PRIMARY KEY,
       icon TEXT DEFAULT '❓',
       label TEXT NOT NULL,
       color TEXT DEFAULT '#6366f1',
       position INTEGER DEFAULT 0
     );
     INSERT OR IGNORE INTO call_issue_types (id, icon, label, color, position) VALUES
       ('telephone_injoignable', '📵', 'Téléphone injoignable',   '#ef4444', 0),
       ('contact_not_assigned',  '👤', 'Contact non assigné',     '#f59e0b', 1),
       ('line_breaking_up',      '📶', 'Ligne qui coupe',          '#6366f1', 2),
       ('client_cant_hear',      '🔇', 'Le client n''entend pas bien', '#8b5cf6', 3);`,

    // v11: traduction française des catégories de problèmes par défaut
    `UPDATE call_issue_types SET label='Contact non assigné'         WHERE id='contact_not_assigned';
     UPDATE call_issue_types SET label='Ligne qui coupe'              WHERE id='line_breaking_up';
     UPDATE call_issue_types SET label='Le client n''entend pas bien' WHERE id='client_cant_hear';`,

    // v12: multi-marché — table de jointure user_marches + migration des données existantes
    `CREATE TABLE IF NOT EXISTS user_marches (
       user_id   TEXT NOT NULL,
       marche_id TEXT NOT NULL,
       PRIMARY KEY (user_id, marche_id)
     );
     INSERT OR IGNORE INTO user_marches (user_id, marche_id)
       SELECT id, marche_id FROM users WHERE marche_id IS NOT NULL;`,

    // v13: nombre d'appels effectués par RDV
    `ALTER TABLE rdvs ADD COLUMN nb_appels INTEGER DEFAULT 0;`,

    // v14: journal d'appels hebdomadaire par SDR (saisi par admin)
    `CREATE TABLE IF NOT EXISTS call_logs (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL,
       semaine INTEGER NOT NULL,
       annee INTEGER NOT NULL,
       nb_appels INTEGER DEFAULT 0,
       created_at TEXT DEFAULT (datetime('now')),
       UNIQUE(sdr_id, semaine, annee)
     );`,

    // v15: historique des objectifs mensuels — permet taux cohérent par semaine/année
    `CREATE TABLE IF NOT EXISTS objectif_history (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL,
       objectif INTEGER NOT NULL,
       effective_from TEXT NOT NULL,
       created_at TEXT DEFAULT (datetime('now')),
       UNIQUE(sdr_id, effective_from)
     );
     INSERT OR IGNORE INTO objectif_history (id, sdr_id, objectif, effective_from)
     SELECT sdr_id || '_init', sdr_id, objectif_rdv_done, '2000-01'
     FROM objectifs;`,

    // v16: statut des problèmes d'appel (open / dismissed / archived)
    `ALTER TABLE call_issues ADD COLUMN status TEXT DEFAULT 'open';`,

    // v17: expiration des tokens d'invitation
    `ALTER TABLE users ADD COLUMN invite_expires TEXT;`,

    // v18: index sur les colonnes filtrées fréquemment (performances requêtes)
    // (recréés en v19 après la migration FK — laissés ici pour les bases déjà à v18)
    `CREATE INDEX IF NOT EXISTS idx_rdvs_sdr      ON rdvs(sdr_id);
     CREATE INDEX IF NOT EXISTS idx_rdvs_marche   ON rdvs(marche_id);
     CREATE INDEX IF NOT EXISTS idx_rdvs_week     ON rdvs(semaine, annee);
     CREATE INDEX IF NOT EXISTS idx_rdvs_date_pris ON rdvs(date_pris);
     CREATE INDEX IF NOT EXISTS idx_rdvs_date_done ON rdvs(date_done);
     CREATE INDEX IF NOT EXISTS idx_rdvs_status   ON rdvs(status);
     CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
     CREATE INDEX IF NOT EXISTS idx_call_logs_sdr ON call_logs(sdr_id);
     CREATE INDEX IF NOT EXISTS idx_badges_user   ON badges(user_id);
     CREATE INDEX IF NOT EXISTS idx_call_issues_sdr ON call_issues(sdr_id);`,

    // v19: Foreign Keys + nettoyage orphelins + recréation tables + index
    `DELETE FROM sessions         WHERE user_id    NOT IN (SELECT id FROM users);
     DELETE FROM rdvs             WHERE sdr_id     NOT IN (SELECT id FROM users);
     DELETE FROM rdvs             WHERE marche_id  NOT IN (SELECT id FROM marches);
     DELETE FROM badges           WHERE user_id    NOT IN (SELECT id FROM users);
     DELETE FROM call_logs        WHERE sdr_id     NOT IN (SELECT id FROM users);
     DELETE FROM objectifs        WHERE sdr_id     NOT IN (SELECT id FROM users);
     DELETE FROM objectif_history WHERE sdr_id     NOT IN (SELECT id FROM users);
     DELETE FROM call_issues      WHERE sdr_id     NOT IN (SELECT id FROM users);
     DELETE FROM user_marches     WHERE user_id    NOT IN (SELECT id FROM users);
     DELETE FROM user_marches     WHERE marche_id  NOT IN (SELECT id FROM marches);
     PRAGMA foreign_keys = OFF;
     BEGIN TRANSACTION;
     ALTER TABLE sessions RENAME TO _sessions_old;
     CREATE TABLE sessions (
       token TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       name TEXT, role TEXT, expires_at TEXT NOT NULL
     );
     INSERT INTO sessions (token, user_id, name, role, expires_at)
       SELECT token, user_id, name, role, expires_at FROM _sessions_old;
     DROP TABLE _sessions_old;
     ALTER TABLE rdvs RENAME TO _rdvs_old;
     CREATE TABLE rdvs (
       id TEXT PRIMARY KEY,
       sdr_id    TEXT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
       marche_id TEXT NOT NULL REFERENCES marches(id) ON DELETE RESTRICT,
       semaine INTEGER NOT NULL, annee INTEGER NOT NULL,
       crm_url_pris TEXT, date_pris TEXT, date_prevue TEXT,
       crm_url_done TEXT, date_done TEXT,
       status TEXT DEFAULT 'pris', notes TEXT,
       created_at TEXT DEFAULT (datetime('now')),
       archived INTEGER DEFAULT 0, nb_appels INTEGER DEFAULT 0
     );
     INSERT INTO rdvs (id,sdr_id,marche_id,semaine,annee,crm_url_pris,date_pris,date_prevue,crm_url_done,date_done,status,notes,created_at,archived,nb_appels)
       SELECT id,sdr_id,marche_id,semaine,annee,crm_url_pris,date_pris,date_prevue,crm_url_done,date_done,status,notes,created_at,archived,nb_appels FROM _rdvs_old;
     DROP TABLE _rdvs_old;
     ALTER TABLE badges RENAME TO _badges_old;
     CREATE TABLE badges (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       rank INTEGER NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL,
       rdv_done INTEGER DEFAULT 0, awarded_at TEXT DEFAULT (datetime('now')),
       seen INTEGER DEFAULT 0, dismissed INTEGER DEFAULT 0,
       UNIQUE(user_id, month, year)
     );
     INSERT INTO badges (id,user_id,rank,month,year,rdv_done,awarded_at,seen,dismissed)
       SELECT id,user_id,rank,month,year,rdv_done,awarded_at,seen,dismissed FROM _badges_old;
     DROP TABLE _badges_old;
     ALTER TABLE call_logs RENAME TO _call_logs_old;
     CREATE TABLE call_logs (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       semaine INTEGER NOT NULL, annee INTEGER NOT NULL,
       nb_appels INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
       UNIQUE(sdr_id, semaine, annee)
     );
     INSERT INTO call_logs (id,sdr_id,semaine,annee,nb_appels,created_at)
       SELECT id,sdr_id,semaine,annee,nb_appels,created_at FROM _call_logs_old;
     DROP TABLE _call_logs_old;
     ALTER TABLE objectifs RENAME TO _objectifs_old;
     CREATE TABLE objectifs (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
       objectif_rdv_done INTEGER DEFAULT 8
     );
     INSERT INTO objectifs (id,sdr_id,objectif_rdv_done)
       SELECT id,sdr_id,objectif_rdv_done FROM _objectifs_old;
     DROP TABLE _objectifs_old;
     ALTER TABLE objectif_history RENAME TO _objectif_history_old;
     CREATE TABLE objectif_history (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       objectif INTEGER NOT NULL, effective_from TEXT NOT NULL,
       created_at TEXT DEFAULT (datetime('now')),
       UNIQUE(sdr_id, effective_from)
     );
     INSERT INTO objectif_history (id,sdr_id,objectif,effective_from,created_at)
       SELECT id,sdr_id,objectif,effective_from,created_at FROM _objectif_history_old;
     DROP TABLE _objectif_history_old;
     ALTER TABLE call_issues RENAME TO _call_issues_old;
     CREATE TABLE call_issues (
       id TEXT PRIMARY KEY,
       sdr_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       marche_id TEXT, issue_type TEXT NOT NULL, date TEXT, notes TEXT,
       created_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'open'
     );
     INSERT INTO call_issues (id,sdr_id,marche_id,issue_type,date,notes,created_at,status)
       SELECT id,sdr_id,marche_id,issue_type,date,notes,created_at,status FROM _call_issues_old;
     DROP TABLE _call_issues_old;
     ALTER TABLE user_marches RENAME TO _user_marches_old;
     CREATE TABLE user_marches (
       user_id   TEXT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
       marche_id TEXT NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
       PRIMARY KEY (user_id, marche_id)
     );
     INSERT INTO user_marches (user_id, marche_id)
       SELECT user_id, marche_id FROM _user_marches_old;
     DROP TABLE _user_marches_old;
     CREATE INDEX IF NOT EXISTS idx_rdvs_sdr       ON rdvs(sdr_id);
     CREATE INDEX IF NOT EXISTS idx_rdvs_marche    ON rdvs(marche_id);
     CREATE INDEX IF NOT EXISTS idx_rdvs_week      ON rdvs(semaine, annee);
     CREATE INDEX IF NOT EXISTS idx_rdvs_date_pris ON rdvs(date_pris);
     CREATE INDEX IF NOT EXISTS idx_rdvs_date_done ON rdvs(date_done);
     CREATE INDEX IF NOT EXISTS idx_rdvs_status    ON rdvs(status);
     CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(user_id);
     CREATE INDEX IF NOT EXISTS idx_call_logs_sdr  ON call_logs(sdr_id);
     CREATE INDEX IF NOT EXISTS idx_badges_user    ON badges(user_id);
     CREATE INDEX IF NOT EXISTS idx_call_issues_sdr ON call_issues(sdr_id);
     COMMIT;
     PRAGMA foreign_keys = ON;`,
  ];

  for (let i = current; i < migrations.length; i++) {
    db.run(migrations[i]);
    db.run(`INSERT INTO schema_version VALUES (${i + 1}, datetime('now'))`);
  }

  // Seed default marchés
  const marchesCount = db.exec(`SELECT COUNT(*) FROM marches`)[0].values[0][0];
  if (marchesCount === 0) {
    const defaults = [
      ['mada', 'Madagascar', 'MADA', '#22c55e', 0],
      ['lux', 'Luxembourg', 'LUX', '#3b82f6', 1],
      ['fr', 'France', 'FR', '#6366f1', 2],
      ['ch', 'Suisse', 'CH', '#ef4444', 3],
      ['sg', 'Singapour', 'SG', '#f59e0b', 4],
      ['ca', 'Canada', 'CA', '#ec4899', 5],
      ['uk', 'UK', 'UK', '#8b5cf6', 6],
      ['sa', 'Arabie Saoudite', 'SA', '#14b8a6', 7],
    ];
    defaults.forEach(m => db.run(`INSERT OR IGNORE INTO marches (id, name, code, color, position) VALUES (?,?,?,?,?)`, m));
  }
}

module.exports = { getDB, saveDB };
