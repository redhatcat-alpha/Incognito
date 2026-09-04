import { z } from 'zod';

import { reportReasons } from '@/lib/report-reasons';

const tagNameSchema = z.string().trim().min(1).max(20);

/** 发言身份：anonymous=匿名代号，registered=注册用户名（固定 ID）。 */
const identitySchema = z.enum(['anonymous', 'registered']).default('anonymous');

export const createPostSchema = z.object({
  boardSlug: z.enum(['tucao', 'tech', 'trending']),
  title: z.string().trim().min(4, '标题至少需要 4 个字').max(120),
  body: z.string().trim().min(1, '正文不能为空').max(60_000),
  tags: z.array(tagNameSchema).max(5).default([]),
  identity: identitySchema,
});

export const editPostSchema = z.object({
  title: z.string().trim().min(4, '标题至少需要 4 个字').max(120),
  body: z.string().trim().min(1, '正文不能为空').max(60_000),
  tags: z.array(tagNameSchema).max(5).default([]),
});

export const createReplySchema = z.object({
  body: z.string().trim().min(1, '回复不能为空').max(30_000),
  quoteReplyId: z.string().trim().max(80).nullable().optional(),
  identity: identitySchema,
});

export const editReplySchema = z.object({
  body: z.string().trim().min(1, '回复不能为空').max(30_000),
});

export const voteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export const progressSchema = z.object({
  maxReadFloor: z.number().int().min(1),
  anchorReplyId: z.string().trim().max(80).nullable().optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(['post', 'reply']),
  publicId: z.string().trim().min(1).max(80),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(500).optional().default(''),
});

export const sessionPatchSchema = z.object({
  historySyncEnabled: z.boolean(),
});

export const avatarPatchSchema = z.object({
  avatarSeed: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少 3 个字符')
  .max(20, '用户名最多 20 个字符')
  .regex(/^[\p{L}\p{N}_-]+$/u, '用户名只能包含中英文、数字、下划线与连字符');

export const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
});

export const adminAnnouncementSchema = z.object({
  title: z.string().trim().min(1, '公告标题不能为空').max(120),
  body: z.string().trim().min(1, '公告正文不能为空').max(5000),
  level: z.enum(['info', 'reminder', 'warning', 'urgent']).default('info'),
  endsAt: z.number().int().nullable().optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, '请输入密码').max(72),
});
