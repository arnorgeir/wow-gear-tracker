import type { Metadata } from 'next';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono' });

export const metadata: Metadata = { title: 'Gear Tracker', description: 'WoW gear versus BiS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
