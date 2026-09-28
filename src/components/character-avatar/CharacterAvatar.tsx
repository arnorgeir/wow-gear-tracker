import { classColor } from '@/components/shared/class-colors';

interface Props {
  name: string;
  className: string;
  avatarUrl: string | null;
  classIconUrl: string | null;
  size: number;
}

/** The avatar in a class-colored ring. Falls back to the class icon, then to the class-colored initial. Decorative: the name is always shown beside it. */
export function CharacterAvatar({ name, className, avatarUrl, classIconUrl, size }: Props) {
  const color = classColor(className);
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
