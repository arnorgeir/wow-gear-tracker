import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Suspense } from 'react';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import { WowheadRefresh } from '@/components/WowheadRefresh';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono' });

export const metadata: Metadata = { title: 'Gear Tracker', description: 'WoW gear versus BiS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <header className="border-b border-line bg-[#1a1713]">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-16">
            <Link href="/" className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-ink no-underline">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" />
              </svg>
              Gear Tracker
            </Link>
            <nav aria-label="Main" className="flex gap-2">
              <Link href="/" className="rounded-lg bg-raised px-4 py-2.5 text-[15px] font-semibold text-ink no-underline">Characters</Link>
            </nav>
          </div>
        </header>
        {children}
        <Script id="wowhead-config" strategy="beforeInteractive">
          {'window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };'}
        </Script>
        <Script src="https://wow.zamimg.com/js/tooltips.js" strategy="afterInteractive" />
        <Suspense fallback={null}><WowheadRefresh /></Suspense>
      </body>
    </html>
  );
}
