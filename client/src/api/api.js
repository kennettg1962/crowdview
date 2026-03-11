import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || 'http://localhost:5000',
  timeout: 60000
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('cv_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('cv_token');
      sessionStorage.removeItem('cv_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
