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
        <header className="relative border-b border-line bg-header">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-16">
            <Link href="/" className="flex items-center gap-3 font-display text-[22px] font-bold tracking-wide text-ink no-underline">
              <BrandMark size={32} className="shrink-0 text-gold" />
              Gear Tracker
            </Link>
            <MainNav />
          </div>
          {/* The divider motif: a gold diamond centred on the header's bottom line. */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 size-3 -translate-x-1/2 translate-y-1/2 rotate-45 border border-gold bg-header" />
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
