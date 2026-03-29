import api from './client';
import type { CreditBalance, LedgerEntry } from '../types/index';

export const creditsApi = {
  balance: () => api.get<CreditBalance>('/credits/balance').then(r => r.data),

  history: () =>
    api.get<LedgerEntry[]>('/credits/history').then(r => r.data),

  userBalance: (userId: number) =>
    api.get<CreditBalance>(`/credits/${userId}/balance`).then(r => r.data),
};