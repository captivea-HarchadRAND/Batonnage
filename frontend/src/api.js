const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  getInvite: (token) => request('GET', `/auth/invite/${token}`),
  acceptInvite: (token, password) => request('POST', `/auth/invite/${token}`, { password }),

  // Marchés
  getMarches: () => request('GET', '/marches'),

  // RDVs
  getRdvs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/rdvs${q ? '?' + q : ''}`);
  },
  createRdv: (data) => request('POST', '/rdvs', data),
  updateRdv: (id, data) => request('PUT', `/rdvs/${id}`, data),
  deleteRdv: (id) => request('DELETE', `/rdvs/${id}`),
  archiveRdv: (id) => request('PUT', `/rdvs/${id}/archive`),
  bulkDoneRdvs: (ids, date_done) => request('POST', '/rdvs/bulk-done', { ids, date_done }),
  bulkArchiveRdvs: (ids) => request('POST', '/rdvs/bulk-archive', { ids }),
  bulkDeleteRdvs: (ids) => request('POST', '/rdvs/bulk-delete', { ids }),

  // Stats
  getStats: () => request('GET', '/stats'),

  // Synthesis
  getSynthesis: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/synthesis${q ? '?' + q : ''}`);
  },

  // Leaderboard
  getLeaderboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/leaderboard${q ? '?' + q : ''}`);
  },

  // Profile
  updateProfile: (data) => request('PUT', '/profile', data),
  updateAvatar: (avatar) => request('PUT', '/profile/avatar', { avatar }),
  getProfileStats: () => request('GET', '/profile/stats'),
  getProfileTrend: () => request('GET', '/profile/trend'),
  getProfileRank: () => request('GET', '/profile/rank'),
  getBadges: () => request('GET', '/profile/badges'),
  getNotifications: () => request('GET', '/profile/notifications'),
  getReminders: () => request('GET', '/reminders'),
  markBadgesSeen: () => request('PUT', '/profile/badges/seen'),
  markBadgeSeen: (id) => request('PUT', `/profile/badges/${id}/seen`),
  dismissNotif: (id) => request('DELETE', `/profile/badges/${id}`),

  // Settings
  getSettings: () => request('GET', '/settings'),
  updateSettings: (data) => request('PUT', '/admin/settings', data),

  // Admin: Users
  getUsers: () => request('GET', '/admin/users'),
  createUser: (data) => request('POST', '/admin/users', data),
  updateUser: (id, data) => request('PUT', `/admin/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/admin/users/${id}`),
  // resendInvite: (id) => request('POST', `/admin/users/${id}/resend-invite`),
  getCallLogs: () => request('GET', '/admin/call-logs'),
  saveCallLog: (sdrId, semaine, annee, nb_appels) => request('PUT', `/admin/call-logs/${sdrId}/${semaine}/${annee}`, { nb_appels }),
  getMyCallLogs: () => request('GET', '/call-logs/me'),

  assignUserToMarche: (userId, marcheId) => request('POST', `/admin/users/${userId}/marches/${marcheId}`),
  unassignUserFromMarche: (userId, marcheId) => request('DELETE', `/admin/users/${userId}/marches/${marcheId}`),

  // Admin: Marchés
  getAdminMarches: () => request('GET', '/admin/marches'),
  createMarche: (data) => request('POST', '/admin/marches', data),
  updateMarche: (id, data) => request('PUT', `/admin/marches/${id}`, data),
  deleteMarche: (id) => request('DELETE', `/admin/marches/${id}`),
  archiveMarche: (id) => request('PATCH', `/admin/marches/${id}/archive`),
  unarchiveMarche: (id) => request('PATCH', `/admin/marches/${id}/unarchive`),

  // Admin: Performance
  getPerformance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/admin/performance${q ? '?' + q : ''}`);
  },

  // Call Issue Types
  getCallIssueTypes: () => request('GET', '/call-issue-types'),
  createCallIssueType: (data) => request('POST', '/call-issue-types', data),
  deleteCallIssueType: (id) => request('DELETE', `/call-issue-types/${id}`),

  // Call Issues
  createCallIssue: (data) => request('POST', '/call-issues', data),
  getCallIssues: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/call-issues${q ? '?' + q : ''}`);
  },
  updateCallIssueStatus: (id, status) => request('PUT', `/call-issues/${id}/status`, { status }),
  deleteCallIssue: (id) => request('DELETE', `/call-issues/${id}`),

  // Admin: Objectifs
  getObjectifs: () => request('GET', '/admin/objectifs'),
  updateObjectif: (sdr_id, objectif_rdv_done) => request('PUT', `/admin/objectifs/${sdr_id}`, { objectif_rdv_done }),
  resetUserPassword: (id, password) => request('PUT', `/admin/users/${id}/reset-password`, { password }),
  getManualRdvs: () => request('GET', '/admin/rdvs/manual'),
  saveManualRdv: (sdrId, week, year, marche_id, pris, done) =>
    request('PUT', `/admin/rdvs/manual/${sdrId}/${week}/${year}`, { marche_id, pris, done }),

  // Sécurité
  getSecurity: () => request('GET', '/admin/security'),
  unblockIp: (ip) => request('DELETE', '/admin/security/unblock', { ip }),
};
