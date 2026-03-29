import api from './client';
import type { Product } from '../types/index';

export const productsApi = {
  list: () => api.get<Product[]>('/products/').then(r => r.data),
};