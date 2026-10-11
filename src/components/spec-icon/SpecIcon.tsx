import { classColor } from '@/components/shared/class-colors';

interface Props {
  /** The spec's icon, or its class icon: the loader already picked the fallback. */
  url: string | null;
  className: string;
  /** Pixels, or `fill` to take the size of the box around it. */
  size: number | 'fill';
  /** A class-colored border for headline icons; a neutral one inside lists. */
  ring?: 'class' | 'neutral';
  /** Rounds to the design's radius for this size. */
  corner?: number;
}

/** A spec's icon in a bordered square. Decorative: the spec's name is always beside it. */
export function SpecIcon({ url, className, size, ring = 'neutral', corner = 7 }: Props) {
  const style = {
    width: size === 'fill' ? '100%' : size, height: size === 'fill' ? '100%' : size, borderRadius: corner,
    borderWidth: ring === 'class' ? 2 : 1,
    borderColor: ring === 'class' ? classColor(className) : 'var(--color-line-strong)',
  };
  return url
    ? <img src={url} alt="" width={size === 'fill' ? undefined : size} height={size === 'fill' ? undefined : size} className="shrink-0 border-solid bg-surface-2" style={style} />
    : <span aria-hidden="true" className="block shrink-0 border-solid bg-surface-2" style={style} />;
}
