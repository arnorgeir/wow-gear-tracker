import type { Quality } from '@/core/types';

export const QUALITY_STYLES: Record<Quality, { ring: string; text: string; bg: string; border: string }> = {
  POOR: { ring: '#9d9d9d', text: '#b5b5b5', bg: '#1c1b1a', border: '#3d3b38' },
  COMMON: { ring: '#ffffff', text: '#f2f2f2', bg: '#1f1e1c', border: '#4a4744' },
  UNCOMMON: { ring: '#1eff00', text: '#6cf36c', bg: '#17200f', border: '#2f5a1f' },
  RARE: { ring: '#0070dd', text: '#5eaaff', bg: '#111b28', border: '#1f4670' },
  EPIC: { ring: '#a335ee', text: '#c58cf5', bg: '#1e1628', border: '#4f2c70' },
  LEGENDARY: { ring: '#ff8000', text: '#ffa64d', bg: '#2a1c0e', border: '#704014' },
  ARTIFACT: { ring: '#e6cc80', text: '#e6cc80', bg: '#262116', border: '#6b5d33' },
  HEIRLOOM: { ring: '#00ccff', text: '#5cdcff', bg: '#10222a', border: '#1d5566' },
};
