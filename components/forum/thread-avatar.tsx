import { cn } from '@/lib/utils';

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const palettes = [
  ['#ff795b', '#ffd1c4'],
  ['#43a5ff', '#cfe6ff'],
  ['#d9ff57', '#f2ffc2'],
  ['#a06bff', '#e6d9ff'],
  ['#2ec4b6', '#c9f2ee'],
  ['#ff9f43', '#ffe3c4'],
  ['#e56b8f', '#ffd9e3'],
  ['#6b8fff', '#d6e0ff'],
];

/** 由种子派生的确定性图案头像，同一帖子内同一账号保持不变。 */
export function ThreadAvatar({ seed, label, className }: { seed: string; label?: string; className?: string }) {
  if (seed.startsWith('/api/v1/media/')) {
    return <span aria-hidden="true" className={cn('relative inline-block shrink-0 overflow-hidden rounded-full', className)}>{/* oxlint-disable-next-line next/no-img-element */}<img src={seed} alt="" className="h-full w-full object-cover" /></span>;
  }
  const hash = hashText(seed || 'anonymous');
  const [dark, light] = palettes[hash % palettes.length];
  const rotate = hash % 360;
  return (
    <span aria-hidden="true" className={cn('relative inline-block shrink-0 overflow-hidden rounded-full', className)}>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="block h-full w-full">
        <circle cx="20" cy="20" r="20" fill={light} />
        <g transform={`rotate(${rotate} 20 20)`}>
          <circle cx="26" cy="14" r="11" fill={dark} opacity="0.85" />
          <circle cx="13" cy="27" r="8" fill="#111815" opacity="0.16" />
        </g>
        {label ? (
          <text
            x="20"
            y="20"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fontWeight="800"
            fill="#111815"
            fontFamily="Space Grotesk, ui-monospace, monospace"
          >
            {label.slice(0, 2).toUpperCase()}
          </text>
        ) : null}
      </svg>

    </span>
  );
}
