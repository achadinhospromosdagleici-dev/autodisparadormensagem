import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/jwt';

export async function saveUserSetting(key: string, value: unknown): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  await api.post('/settings/user/' + key, { value });
}

export async function loadUserSetting<T>(key: string): Promise<T | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const { data } = await api.get('/settings/user/' + key);
  return (data?.value ?? null) as T | null;
}

export async function clearUserSetting(key: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  await api.delete('/settings/user/' + key);
}

export async function saveUserData<T>(table: string, data: Record<string, unknown>): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  await api.post('/settings/user/' + table, { value: { ...data, user_id: userId } });
}

export async function loadUserData<T>(table: string): Promise<T[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const { data } = await api.get('/settings/user/' + table);
  const value = data?.value;
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return [value] as T[];
  return [];
}

export async function deleteUserData(table: string, id: string): Promise<void> {
  await saveUserData(table, { deletedAt: new Date().toISOString(), id });
}
