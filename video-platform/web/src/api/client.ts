const API_BASE = window.location.origin + '/api';

export { API_BASE };

export const api = {
  get: (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json()),
  post: (path: string, body: object) => fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json()),
};

