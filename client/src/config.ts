const rawBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export const API_BASE_URL = rawBase.replace(/\/$/, '');
