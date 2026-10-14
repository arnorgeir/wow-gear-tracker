import { classColor } from '@/components/shared/class-colors';

interface Props {
  name: string;
  className: string;
  avatarUrl: string | null;
  classIconUrl: string | null;
  size: number;
  /** Pins the class icon to the avatar's corner; the value names the background it sits on. */
  classBadge?: 'surface' | 'bg';
}

/** The avatar in a class-colored ring. Falls back to the class icon, then to the class-colored initial. Decorative: the name is always shown beside it. */
export function CharacterAvatar({ name, className, avatarUrl, classIconUrl, size, classBadge }: Props) {
  const color = classColor(className);
  if (classBadge && avatarUrl && classIconUrl) {
    const badge = Math.round(size * 0.4);
    return (
      <span className="relative block shrink-0" style={{ width: size, height: size }}>
        <img src={avatarUrl} alt="" width={size} height={size}
          className="block rounded-full border-2 bg-bg object-cover" style={{ width: size, height: size, borderColor: color }} />
        <img src={classIconUrl} alt="" width={badge} height={badge}
          className={`absolute -bottom-1 -right-1 block rounded-md border-2 ${classBadge === 'surface' ? 'border-surface' : 'border-bg'}`}
          style={{ width: badge, height: badge }} />
      </span>
    );
  }
  const src = avatarUrl ?? classIconUrl;
  if (src) {
    return (
      <img src={src} alt="" width={size} height={size}
        className="shrink-0 rounded-full border-2 bg-bg object-cover" style={{ width: size, height: size, borderColor: color }} />
    );
  }
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full border-2 bg-bg font-bold"
      style={{ width: size, height: size, borderColor: color, color, fontSize: Math.round(size * 0.4) }}>{name.charAt(0)}</span>
  );
}
