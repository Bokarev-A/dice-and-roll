import api from './client';
import type { Order, QRPaymentInfo } from '../types/index';

export const ordersApi = {
  create: (productId: number) =>
    api.post<Order>('/orders/', { product_id: productId }).then(r => r.data),

  myOrders: () => api.get<Order[]>('/orders/my').then(r => r.data),

  myActive: () => api.get<Order>('/orders/my/active').then(r => r.data),

  getQR: () => api.get<QRPaymentInfo>('/orders/my/active/qr').then(r => r.data),

  markPaid: (orderId: number) =>
    api.post<Order>(`/orders/${orderId}/mark-paid`).then(r => r.data),

  cancel: (orderId: number) =>
    api.post<Order>(`/orders/${orderId}/cancel`).then(r => r.data),

  listPending: () => api.get<Order[]>('/orders/pending').then(r => r.data),

  listAll: (status?: string) =>
    api.get<Order[]>('/orders/all', {
      params: status ? { status_filter: status } : {},
    }).then(r => r.data),

  confirm: (orderId: number) =>
    api.post<Order>(`/orders/${orderId}/confirm`).then(r => r.data),

  reject: (orderId: number, reason: string) =>
    api.post<Order>(`/orders/${orderId}/reject`, { reason }).then(r => r.data),

  delete: (orderId: number) =>
    api.delete(`/orders/${orderId}`),
};