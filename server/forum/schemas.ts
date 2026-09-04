import { z } from 'zod';

import { reportReasons } from '@/lib/report-reasons';

const tagNameSchema = z.string().trim().min(1).max(20);

export const createPostSchema = z.object({
  boardSlug: z.enum(['tucao', 'tech', 'trending']),
  title: z.string().trim().min(4, '标题至少需要 4 个字').max(120),
  body: z.string().trim().min(1, '正文不能为空').max(20_000),
  tags: z.array(tagNameSchema).max(5).default([]),
});

export const editPostSchema = z.object({
  title: z.string().trim().min(4, '标题至少需要 4 个字').max(120),
  body: z.string().trim().min(1, '正文不能为空').max(20_000),
  tags: z.array(tagNameSchema).max(5).default([]),
});

export const createReplySchema = z.object({
  body: z.string().trim().min(1, '回复不能为空').max(10_000),
  quoteReplyId: z.string().trim().max(80).nullable().optional(),
});

export const editReplySchema = z.object({
  body: z.string().trim().min(1, '回复不能为空').max(10_000),
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
