const API = '/api';

/** React가 setState를 먼저 커밋하도록 다음 틱까지 대기 (ProgressBar 표시 보장) */
export const nextTick = () => new Promise((r) => setTimeout(r, 0));

function getAuthHeader() {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  getAccountItems: () => fetchJson(`${API}/account-items`),
  getProjects: () => fetchJson(`${API}/projects`),
  suggestAccount: (q) => fetchJson(`${API}/suggest-account?q=${encodeURIComponent(q || '')}`),
  getDocuments: (params) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`${API}/documents${q ? '?' + q : ''}`);
  },
  getDocument: (id) => fetchJson(`${API}/documents/${id}`),
  createDocument: (body) => fetchJson(`${API}/documents`, { method: 'POST', body: JSON.stringify(body) }),
  updateDocument: (id, body) => fetchJson(`${API}/documents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  submitDocument: (id) => fetchJson(`${API}/documents/${id}/submit`, { method: 'POST' }),
  withdrawDocument: (id) => fetchJson(`${API}/documents/${id}/withdraw`, { method: 'POST' }),
  deleteDocument: (id) => fetchJson(`${API}/documents/${id}`, { method: 'DELETE' }),
  approveDocument: (id, body) => fetchJson(`${API}/documents/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  downloadBatchApprovalExcel: (params) => {
    const q = params && Object.keys(params).length
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString()
      : '';
    return fetch(`${API}/export/batch-approval-excel${q}`, { headers: getAuthHeader() });
  },
  getUsers: () => fetchJson(`${API}/users`),
  getExpenses: (params) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? '' : String(v)])
      )
    ).toString();
    return fetchJson(`${API}/expenses${q ? '?' + q : ''}`);
  },
  getDashboardSummary: (params) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`${API}/dashboard/summary${q ? '?' + q : ''}`);
  },
  updateProject: (id, body) => fetchJson(`${API}/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProject: (id) => fetchJson(`${API}/projects/${id}`, { method: 'DELETE' }),
  createAccountItem: (body) => fetchJson(`${API}/account-items`, { method: 'POST', body: JSON.stringify(body) }),
  updateAccountItem: (id, body) => fetchJson(`${API}/account-items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAccountItem: (id) => fetchJson(`${API}/account-items/${id}`, { method: 'DELETE' }),
  createProject: (body) => fetchJson(`${API}/projects`, { method: 'POST', body: JSON.stringify(body) }),
  importCsv: (body) => fetchJson(`${API}/import/csv`, { method: 'POST', body: JSON.stringify(body) }),
  getUserCards: (userName, all) => {
    const p = new URLSearchParams();
    if (all) p.set('all', '1');
    else if (userName) p.set('user_name', userName);
    return fetchJson(`${API}/user-cards${p.toString() ? '?' + p : ''}`);
  },
  createUserCard: (body) => fetchJson(`${API}/user-cards`, { method: 'POST', body: JSON.stringify(body) }),
  updateUserCard: (id, body) => fetchJson(`${API}/user-cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUserCard: (id) => fetchJson(`${API}/user-cards/${id}`, { method: 'DELETE' }),
  getUserSettings: (userName) => fetchJson(`${API}/user-settings?user_name=${encodeURIComponent(userName || '')}`),
  updateUserSettings: (body) => fetchJson(`${API}/user-settings`, { method: 'PUT', body: JSON.stringify(body) }),
  login: (body) => fetchJson(`${API}/auth/login`, { method: 'POST', body: JSON.stringify(body) }),
  signup: (body) => fetchJson(`${API}/auth/signup`, { method: 'POST', body: JSON.stringify(body) }),
  authMe: () => fetchJson(`${API}/auth/me`),
  getCompanies: () => fetchJson(`${API}/companies`),
  getAdminCompanies: () => fetchJson(`${API}/admin/companies`),
  getAdminCompaniesWithSettings: () => fetchJson(`${API}/admin/companies?with_settings=1`),
  createAdminCompany: (body) => fetchJson(`${API}/admin/companies`, { method: 'POST', body: JSON.stringify(body) }),
  updateCompany: (id, body) => fetchJson(`${API}/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setCompanyDefault: (id) => fetchJson(`${API}/admin/companies/${id}/set-default`, { method: 'PUT' }),
  deleteAdminCompany: (id) => fetchJson(`${API}/admin/companies/${id}`, { method: 'DELETE' }),
  getAdminUsers: (params) => {
    const q = params ? new URLSearchParams(params).toString() : '';
    return fetchJson(`${API}/admin/users${q ? '?' + q : ''}`);
  },
  createAdminUser: (body) => fetchJson(`${API}/admin/users`, { method: 'POST', body: JSON.stringify(body) }),
  updateAdminUser: (id, body) => fetchJson(`${API}/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  approveAdminUser: (id) => fetchJson(`${API}/admin/users/${id}/approve`, { method: 'POST' }),
  getAdminRoles: () => fetchJson(`${API}/admin/roles`),
  createAdminRole: (body) => fetchJson(`${API}/admin/roles`, { method: 'POST', body: JSON.stringify(body) }),
  updateAdminRole: (id, body) => fetchJson(`${API}/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAdminRole: (id) => fetchJson(`${API}/admin/roles/${id}`, { method: 'DELETE' }),
  getRoleMenus: () => fetchJson(`${API}/admin/role-menus`),
  updateRoleMenus: (body) => fetchJson(`${API}/admin/role-menus`, { method: 'PUT', body: JSON.stringify(body) }),
  getApprovalSequences: () => fetchJson(`${API}/admin/approval-sequences`),
  getAdminBatchApprovalSequence: () => fetchJson(`${API}/admin/batch/approval-sequence`),
  updateApprovalSequences: (body) => fetchJson(`${API}/admin/approval-sequences`, { method: 'PUT', body: JSON.stringify(body) }),
  getAdminBatchRolePermissions: () => fetchJson(`${API}/admin/batch/role-permissions`),
  getAdminBatchUsersPage: (params) => {
    const q = params ? new URLSearchParams(params).toString() : '';
    return fetchJson(`${API}/admin/batch/users-page${q ? '?' + q : ''}`);
  },
  getAdminEditHistory: (params) => {
    const q = params ? new URLSearchParams(params).toString() : '';
    return fetchJson(`${API}/admin/edit-history${q ? '?' + q : ''}`);
  },
  getCompanySettings: () => fetchJson(`${API}/admin/company-settings`),
  updateCompanySettings: (body) => fetchJson(`${API}/admin/company-settings`, { method: 'PUT', body: JSON.stringify(body) }),
  downloadCeoExcel: () => {
    const t = localStorage.getItem('auth_token');
    return fetch(`${API}/export/ceo-excel`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  },
  getCardSettlement: (params) => {
    const q = params && Object.keys(params).length
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString()
      : '';
    return fetchJson(`${API}/card-settlement${q}`);
  },
  processCardSettlement: (body) => fetchJson(`${API}/card-settlement/process`, { method: 'POST', body: JSON.stringify(body) }),
};
