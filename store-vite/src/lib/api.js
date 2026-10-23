const defaultApiUrl = import.meta.env.PROD
  ? 'https://apithe.fastora.uz'
  : 'http://127.0.0.1:3000';
const baseUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/+$/, '');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = { message };
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = sessionStorage.getItem('thenurab_admin_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new ApiError(payload?.message || `Server xatoligi (${response.status}).`, response.status);
  return payload;
}

function recordBody(values) {
  const hasFiles = Object.values(values).some((value) => value instanceof File)
    || (Array.isArray(values.images) && values.images.some((value) => value instanceof File));
  if (!hasFiles && !Array.isArray(values.images)) return values;

  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (key === 'images' && Array.isArray(value)) {
      form.append('keepImages', JSON.stringify(value.filter((image) => typeof image === 'string')));
      value.filter((image) => image instanceof File).forEach((image) => form.append('images', image, image.name));
    } else if (key === 'image' && value instanceof File) {
      form.append('image', value, value.name);
    } else if (value !== undefined && value !== null) {
      form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    }
  }
  return form;
}

const collection = (name) => ({
  getFullList: ({ sort, filter } = {}) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (filter) params.set('filter', filter);
    const query = params.size ? `?${params}` : '';
    return request(`/api/collections/${encodeURIComponent(name)}/records${query}`);
  },
  getOne: (id) => request(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`),
  create: (values) => request(`/api/collections/${encodeURIComponent(name)}/records`, {
    method: 'POST',
    body: recordBody(values),
  }),
  update: (id, values) => request(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: recordBody(values),
  }),
  delete: (id) => request(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
});

const api = {
  collection,
  send: (path, { method = 'GET', body } = {}) => request(path, { method, body }),
  files: {
    getURL: (record, filename) => {
      const collectionName = record?._collection;
      if (!collectionName || !record?.id || !filename) return '';
      return `${baseUrl}/api/files/${encodeURIComponent(collectionName)}/${encodeURIComponent(record.id)}/${encodeURIComponent(filename)}`;
    },
  },
  admin: {
    getSession: () => request('/api/admin/session'),
    login: async (email, password) => {
      const session = await request('/api/admin/login', { method: 'POST', body: { email, password } });
      sessionStorage.setItem('thenurab_admin_token', session.accessToken);
      return session.admin;
    },
    logout: async () => {
      try {
        await request('/api/admin/logout', { method: 'POST' });
      } finally {
        sessionStorage.removeItem('thenurab_admin_token');
      }
    },
  },
};

export default api;
