import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  async me() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.token) localStorage.setItem('auth_token', data.token);
    return data;
  },

  async register(params: { email: string; password: string; fullName?: string }) {
    const { data } = await api.post('/auth/register', params);
    if (data.token) localStorage.setItem('auth_token', data.token);
    return data;
  },

  logout() {
    localStorage.removeItem('auth_token');
  },
};
