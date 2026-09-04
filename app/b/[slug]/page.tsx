import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ForumHome } from '@/components/forum/forum-home';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  return <ForumHome boardSlug={slug} />;
}
