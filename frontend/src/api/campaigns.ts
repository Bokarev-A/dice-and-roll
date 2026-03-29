import api from './client';
import type { Campaign, CampaignMember } from '../types/index';

export const campaignsApi = {
  list: () => api.get<Campaign[]>('/campaigns/').then(r => r.data),

  getById: (id: number) =>
    api.get<Campaign>(`/campaigns/${id}`).then(r => r.data),

  create: (data: {
    type: string;
    title: string;
    system?: string;
    description?: string;
    visibility?: string;
  }) => api.post<Campaign>('/campaigns/', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    api.patch<Campaign>(`/campaigns/${id}`, data).then(r => r.data),

  listMembers: (id: number) =>
    api.get<CampaignMember[]>(`/campaigns/${id}/members`).then(r => r.data),

  join: (id: number) =>
    api.post<CampaignMember>(`/campaigns/${id}/join`).then(r => r.data),

  leave: (id: number) =>
    api.post(`/campaigns/${id}/leave`).then(r => r.data),
};