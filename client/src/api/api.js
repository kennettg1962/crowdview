import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('cv_token');
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
      localStorage.removeItem('cv_token');
      localStorage.removeItem('cv_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
