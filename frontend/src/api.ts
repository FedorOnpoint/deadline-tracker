export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch { throw new Error('Нет связи с сервером. Проверьте подключение и повторите попытку.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Ошибка сервера (${response.status})`);
  return data as T;
}
