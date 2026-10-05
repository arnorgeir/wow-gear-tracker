import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Suspense } from 'react';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import { BrandMark } from '@/components/brand-mark/BrandMark';
import { MainNav } from '@/components/main-nav/MainNav';
import { WowheadRefresh } from '@/components/wowhead-refresh/WowheadRefresh';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono' });

export const metadata: Metadata = { title: 'Gear Tracker', description: 'WoW gear versus BiS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <header className="border-b border-line bg-header">
          {/* Phones: the brand row above a row of tabs. From sm up: one 64 px row, tabs right after the brand. The right end stays free for account buttons. */}
          <div className="mx-auto flex max-w-[1440px] flex-col px-4 sm:h-16 sm:flex-row sm:gap-10 sm:px-16">
            <Link href="/" className="-mx-2 flex h-[52px] items-center gap-2 self-start px-2 font-display text-[17px] font-bold tracking-wide text-ink no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold sm:h-auto sm:gap-3 sm:self-auto sm:text-[21px]">
              <BrandMark size={32} className="size-[26px] shrink-0 text-gold sm:size-8" />
              Gear Tracker
            </Link>
            <MainNav />
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
