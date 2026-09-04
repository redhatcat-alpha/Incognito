export type ApiEnvelope<T> = { data: T | null; error: { code: string; message: string } | null };

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('NETWORK_ERROR', '网络连接失败，请检查网络后重试');
  }
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || payload.data === null) {
    const message = payload?.error?.message ?? `请求失败（${response.status}）`;
    throw new ApiError(payload?.error?.code ?? 'HTTP_ERROR', message);
  }
  return payload.data;
}
