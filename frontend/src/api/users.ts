import api from './client';
import type { User, UserRole } from '../types/index';

export const usersApi = {
  getMe: () => api.get<User>('/users/me').then(r => r.data),

  listAll: () => api.get<User[]>('/users/').then(r => r.data),

  getById: (id: number) => api.get<User>(`/users/${id}`).then(r => r.data),

  updateRole: (id: number, role: UserRole) =>
    api.patch<User>(`/users/${id}/role`, { role }).then(r => r.data),
};