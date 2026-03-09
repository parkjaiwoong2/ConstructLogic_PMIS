const API = '/api';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
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
  approveDocument: (id, body) => fetchJson(`${API}/documents/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  getExpenses: (params) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`${API}/expenses${q ? '?' + q : ''}`);
  },
  getDashboardSummary: (params) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`${API}/dashboard/summary${q ? '?' + q : ''}`);
  },
  createProject: (body) => fetchJson(`${API}/projects`, { method: 'POST', body: JSON.stringify(body) }),
  createAccountItem: (body) => fetchJson(`${API}/account-items`, { method: 'POST', body: JSON.stringify(body) }),
  importCsv: (body) => fetchJson(`${API}/import/csv`, { method: 'POST', body: JSON.stringify(body) }),
};
