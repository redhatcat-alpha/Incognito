'use client';

import { useCallback, useEffect, useState } from 'react';
import { DatabaseZap, EyeOff, Flame, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Section, SettingsTabs } from '@/components/forum/settings-ui';
import { apiJson } from '@/lib/api';
import type { AnonProfile } from '@/lib/forum-types';

export function SettingsPrivacyView() {
  const [profile, setProfile] = useState<AnonProfile | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiJson<{ profile: AnonProfile }>('/api/v1/anon/session');
      setProfile(data.profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3000);
  };

  async function toggleSync(enabled: boolean) {
    if (!profile) return;
    setSyncing(true);
    try {
      await apiJson('/api/v1/anon/session', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ historySyncEnabled: enabled }),
      });
      await load();
      flash(enabled ? '云端历史已开启' : '云端历史已关闭，服务端历史已清除');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
    } finally {
      setSyncing(false);
    }
  }

  async function clearHistory() {
    try {
      await apiJson('/api/v1/history', { method: 'DELETE' });
      flash('浏览历史已全部清空');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '清空失败');
    }
  }

  async function destroyIdentity() {
    await apiJson('/api/v1/anon/identity', { method: 'DELETE' });
    window.location.assign('/');
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">SETTINGS / 设置</p>
        <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">隐私与数据</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          匿名不等于无痕：为提供投票去重、跨设备续读与违规处置，服务端需要保存一个随机匿名账号。这里可以查看并控制它持有的数据。
        </p>
      </div>
      <SettingsTabs />

      {notice ? (
        <p aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-[#d83b2d]/30 bg-[#fdecea] px-4 py-3 text-sm font-semibold text-[#a02a1f]">
          {error}
          <Button variant="ghost" size="sm" className="ml-2 h-7 rounded-full text-[#a02a1f]" onClick={() => void load()}>
            重试
          </Button>
        </p>
      ) : null}

      {profile === null ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <Section
            title="浏览历史与阅读位置"
            description="服务端只为每个帖子保存一条最新记录：最高已读楼层、最近锚点与最后查看时间，不保存逐次滚动轨迹。"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f8faf6] p-4">
              <div className="flex items-start gap-3">
                <EyeOff className="mt-0.5 size-5 shrink-0 text-[var(--signal-dark)]" />
                <div>
                  <p className="text-sm font-bold">云端历史同步</p>
                  <p className="mt-0.5 max-w-md text-xs leading-5 text-muted-foreground">
                    {profile.historySyncEnabled
                      ? '开启中：历史与阅读进度保存在匿名账号下，可在多设备间续读。'
                      : '已关闭：服务端不再记录历史，既有记录已删除；续读功能不可用。'}
                  </p>
                </div>
              </div>
              <Switch checked={profile.historySyncEnabled} disabled={syncing} onCheckedChange={(value) => void toggleSync(value)} aria-label="云端历史同步开关" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">清空后所有设备同步为空，且不可恢复。</p>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="outline" className="gap-2 rounded-full bg-white text-destructive hover:bg-[#fdecea]" />}
                >
                  <DatabaseZap className="size-4" />清空浏览历史
                </AlertDialogTrigger>
                <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black tracking-tight">清空浏览历史？</AlertDialogTitle>
                    <AlertDialogDescription>阅读位置一并删除，此操作不可撤销。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                    <AlertDialogAction className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]" onClick={() => void clearHistory()}>
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Section>

          <Section
            title="销毁匿名身份"
            description="销毁后，本机的身份令牌、投票归属、浏览历史与恢复能力都会失效；你的公开内容会转为删除占位，楼层讨论保留。"
            tone="danger"
          >
            <div className="space-y-4">
              <ul className="grid gap-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <Flame className="size-4 shrink-0 text-[#d83b2d]" /> 撤销全部会话
                </li>
                <li className="flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-[#d83b2d]" /> 删除投票与浏览历史
                </li>
                <li className="flex items-center gap-2">
                  <Flame className="size-4 shrink-0 text-[#d83b2d]" /> 公开发布转为删除占位
                </li>
                <li className="flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-[#d83b2d]" /> 本机 Cookie 立即失效
                </li>
              </ul>
              <DestroyDialog onConfirm={() => void destroyIdentity()} />
            </div>
          </Section>

          <Section title="无名岛保存了什么" description="数据最小化是我们的默认值，以下数据类别与你的匿名身份关联：">
            <ul className="grid gap-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">随机匿名账号与创建时间</li>
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">会话令牌哈希与最近使用时间</li>
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">你发布与回复的公开内容</li>
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">投票记录（每目标一条）</li>
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">浏览历史（每帖一条，最长 180 天）</li>
              <li className="rounded-lg bg-[#f8faf6] px-3 py-2">举报记录（用于处置复核）</li>
            </ul>
            <p className="mt-4 rounded-xl bg-[var(--signal)]/30 p-4 text-sm leading-6 text-[var(--ink)]">
              我们不收集手机号、邮箱、姓名、IP、完整 User-Agent 或浏览器指纹；不把数据用于广告画像或跨站分析。
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

function DestroyDialog({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) window.setTimeout(() => setConfirmed(false), 200);
      }}
    >
      <DialogTrigger render={<Button className="gap-2 rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]" />}>
        <ShieldAlert className="size-4" />销毁匿名身份
      </DialogTrigger>
      <DialogContent className="border border-[#d83b2d]/30 bg-[#f8faf6] p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight text-[#a02a1f]">真的销毁匿名身份？</DialogTitle>
          <DialogDescription>
            此操作不可撤销：会话、历史、投票归属和恢复能力将全部丢失。你发布的内容会转为“已删除”占位，楼层讨论继续保留。
          </DialogDescription>
        </DialogHeader>
        <label className="mt-2 flex items-start gap-3 rounded-xl border border-black/10 bg-white p-4 text-sm font-semibold">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 accent-[#d83b2d]"
          />
          我理解后果，确认销毁当前匿名身份
        </label>
        <DialogFooter className="mt-4">
          <Button variant="outline" className="rounded-full bg-white" onClick={() => setOpen(false)}>
            再想想
          </Button>
          <Button className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]" disabled={!confirmed} onClick={onConfirm}>
            确认销毁
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
