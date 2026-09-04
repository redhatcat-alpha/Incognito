'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiJson } from '@/lib/api';
import type { AuthMe } from '@/lib/forum-types';

export type RegisteredUserState = {
  me: AuthMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

/** 读取当前注册登录状态；未登录返回 null（匿名身份始终可用，无需登录）。 */
export function useRegisteredUser(): RegisteredUserState {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<AuthMe | null>('/api/v1/auth/me');
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { me, loading, refresh };
}
