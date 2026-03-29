import api from './client';
import type { Attendance, AttendanceStatus, UnpaidEntry } from '../types/index';

export const attendanceApi = {
  init: (sessionId: number) =>
    api.post(`/attendance/session/${sessionId}/init`).then(r => r.data),

  listBySession: (sessionId: number) =>
    api.get<Attendance[]>(`/attendance/session/${sessionId}`).then(r => r.data),

  mark: (sessionId: number, userId: number, status: AttendanceStatus) =>
    api.patch<Attendance>(`/attendance/session/${sessionId}/user/${userId}`, {
      status,
    }).then(r => r.data),

  refund: (sessionId: number, userId: number) =>
    api.post<Attendance>(
      `/attendance/session/${sessionId}/user/${userId}/refund`
    ).then(r => r.data),

  listUnpaid: () =>
    api.get<UnpaidEntry[]>('/attendance/unpaid').then(r => r.data),
};