import api from './client';
import type { Room } from '../types/index';

export const roomsApi = {
  list: () => api.get<Room[]>('/rooms/').then(r => r.data),
};