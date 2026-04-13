import api from './client';
import type { CalendarEntry, PublicSessionEntry } from '../types/index';

export const calendarApi = {
  my: (statusFilter?: string) =>
    api.get<CalendarEntry[]>('/calendar/my', {
      params: statusFilter ? { status_filter: statusFilter } : {},
    }).then(r => r.data),

  public: () =>
    api.get<PublicSessionEntry[]>('/calendar/public').then(r => r.data),

  weekly: (weekStart?: string) =>
    api.get<CalendarEntry[]>('/calendar/weekly', {
      params: weekStart ? { week_start: weekStart } : {},
    }).then(r => r.data),
};