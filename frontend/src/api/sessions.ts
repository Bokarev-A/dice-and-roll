import api from './client';
import type { GameSession, RoomMonthlyStats, GmMonthlyStats } from '../types/index';

export const sessionsApi = {
  getByCampaign: (campaignId: number) =>
    api.get<GameSession[]>(`/sessions/campaign/${campaignId}`).then(r => r.data),

  getById: (id: number) =>
    api.get<GameSession>(`/sessions/${id}`).then(r => r.data),

  create: (data: {
    campaign_id: number;
    room_id: number;
    starts_at: string;
    ends_at: string;
    capacity?: number;
    description?: string;
  }) => api.post<GameSession>('/sessions/', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    api.patch<GameSession>(`/sessions/${id}`, data).then(r => r.data),

  myGmSessions: () =>
    api.get<GameSession[]>('/sessions/gm/my').then(r => r.data),

  gmMonthlyStats: () =>
    api.get<GmMonthlyStats>('/sessions/gm/monthly-stats').then(r => r.data),

  adminMonthlyStats: () =>
    api.get<RoomMonthlyStats[]>('/sessions/admin/monthly-stats').then(r => r.data),
};