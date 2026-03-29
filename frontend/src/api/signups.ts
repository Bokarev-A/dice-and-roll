import api from './client';
import type { Signup } from '../types/index';

export const signupsApi = {
  create: (sessionId: number) =>
    api.post<Signup>('/signups/', { session_id: sessionId }).then(r => r.data),

  my: () => api.get<Signup[]>('/signups/my').then(r => r.data),

  cancel: (signupId: number) =>
    api.post<Signup>(`/signups/${signupId}/cancel`).then(r => r.data),

  listBySession: (sessionId: number) =>
    api.get<Signup[]>(`/signups/session/${sessionId}`).then(r => r.data),

  action: (signupId: number, action: 'approve' | 'reject') =>
    api.post<Signup>(`/signups/${signupId}/action`, { action }).then(r => r.data),

  remove: (signupId: number) =>
    api.delete<Signup>(`/signups/${signupId}`).then(r => r.data),
};