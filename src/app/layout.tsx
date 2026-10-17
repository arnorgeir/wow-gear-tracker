import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Suspense } from 'react';
import { Barlow, Cinzel, IBM_Plex_Mono } from 'next/font/google';
import { BrandMark } from '@/components/brand-mark/BrandMark';
import { AccountNav } from '@/components/account-nav/AccountNav';
import { MainNav } from '@/components/main-nav/MainNav';
import { SettingsGear } from '@/components/settings-gear/SettingsGear';
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
          {/* Phones: the brand row, with the Settings gear at its end, above a row of tabs. From lg up: one 64 px row, tabs right after the brand, Settings at the far right. */}
          <div className="mx-auto flex max-w-[1440px] flex-col px-4 sm:px-16 lg:h-16 lg:flex-row lg:gap-10">
            <div className="flex items-center justify-between lg:contents">
              <Link href="/" className="-mx-2 flex h-[52px] items-center gap-2 px-2 font-display text-[17px] font-bold tracking-wide text-ink no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold lg:h-auto lg:gap-3 lg:text-[21px]">
                <BrandMark size={32} className="size-[26px] shrink-0 text-gold lg:size-8" />
                Gear Tracker
              </Link>
              <SettingsGear />
            </div>
            <MainNav />
            <AccountNav />
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
