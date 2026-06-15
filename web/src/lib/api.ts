import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getAuthLoginURL = (referralCode?: string | null) => {
  const code = (referralCode || localStorage.getItem("referral_code") || "").trim();
  if (!code) {
    return "/auth/login";
  }
  return `/auth/login?ref=${encodeURIComponent(code)}`;
};

// Add a request interceptor to include the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
