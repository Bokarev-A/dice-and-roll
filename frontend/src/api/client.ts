import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add init data to every request
export function setInitData(initData: string) {
  api.defaults.headers.common['X-Init-Data'] = initData;
}

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || 'Unknown error';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export default api;