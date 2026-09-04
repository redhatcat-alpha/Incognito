export type BoardStatus = 'active' | 'readonly' | 'archived' | 'hidden';
export type ContentStatus = 'pending' | 'published' | 'locked' | 'hidden' | 'deleted' | 'archived';

export type BoardSummary = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  status: BoardStatus;
  postCount: number;
};

export type PostSummary = {
  id: string;
  status: ContentStatus;
  board: { slug: string; name: string; accent: string; status: BoardStatus };
  title: string;
  body: string;
  excerpt: string;
  tags: string[];
  score: number;
  upCount: number;
  downCount: number;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  lastRepliedAt: number;
  currentVote: -1 | 0 | 1;
  isMine: boolean;
  authorName: string | null;
  authorUid: number | null;
};

export type ReplySummary = {
  id: string;
  status: 'published' | 'deleted';
  floorNo: number;
  body: string;
  quoteReplyId: string | null;
  alias: string;
  avatarSeed: string;
  isOwner: boolean;
  isMine: boolean;
  score: number;
  upCount: number;
  downCount: number;
  currentVote: -1 | 0 | 1;
  createdAt: number;
  updatedAt: number;
};

export type ForumData = { boards: BoardSummary[]; posts: PostSummary[] };

export type ThreadData = {
  post: PostSummary;
  replies: ReplySummary[];
  history: { maxReadFloor: number; anchorReplyId: string | null; lastViewedAt: number } | null;
  canReply: boolean;
  totalFloors: number;
};

export type HistoryEntry = {
  postId: string;
  title: string;
  board: { name: string; slug: string };
  maxReadFloor: number;
  anchorReplyId: string | null;
  lastViewedAt: number;
  totalFloors: number;
};

export type HistoryData = { enabled: boolean; entries: HistoryEntry[] };

export type Announcement = {
  id: string;
  scope: string;
  level: 'info' | 'reminder' | 'warning' | 'urgent';
  title: string;
  body: string;
  startsAt: number;
  endsAt: number | null;
  createdAt: number;
  read: boolean;
};

export type AdminAnnouncement = {
  id: string;
  scope: string;
  level: string;
  title: string;
  body: string;
  startsAt: number;
  endsAt: number | null;
  status: string;
  createdAt: number;
  readCount: number;
};

export type SiteSettings = { name: string; shortName: string; description: string; primaryColor: string };

export type AuthMe = {
  username: string;
  uid: number;
  createdAt: number;
};

export type AnonProfile = {
  status: string;
  createdAt: number;
  avatarSeed: string;
  historySyncEnabled: boolean;
  activeSessionCount: number;
};

export type AnonSessionInfo = {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revoked: boolean;
  current?: boolean;
};
