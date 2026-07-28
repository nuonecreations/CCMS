export const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.MODE === 'development' ? 'http://localhost:3000' : '/api');

export function getAuthToken() {
  return localStorage.getItem('ccms_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('ccms_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('ccms_token');
}

export function getUser() {
  const u = localStorage.getItem('ccms_user');
  return u ? JSON.parse(u) : null;
}

export function setUser(user: any) {
  localStorage.setItem('ccms_user', JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem('ccms_user');
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    // Unauthorized, logout
    removeAuthToken();
    removeUser();
    window.location.reload();
  }
  return response;
}
