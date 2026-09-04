import { apiJson } from '@/lib/api';
import type { PostSummary } from '@/lib/forum-types';

export type PostIdentity = 'anonymous' | 'registered';

/** 创建帖子（供首页对话框与模型工具共用）。 */
export async function createPostRequest(input: {
  boardSlug: string;
  title: string;
  body: string;
  tags: string[];
  identity?: PostIdentity;
}): Promise<PostSummary> {
  return apiJson<PostSummary>('/api/v1/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, identity: input.identity ?? 'anonymous' }),
  });
}
