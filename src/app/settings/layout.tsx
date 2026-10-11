import { SettingsNav } from '@/components/settings-nav/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 md:flex-row md:items-start md:gap-12 md:px-16 md:py-10">
      <aside className="flex flex-col gap-4 md:w-[220px] md:shrink-0">
        <h1 className="font-display text-[28px] font-bold md:text-[32px]">Settings</h1>
        <SettingsNav />
      </aside>
      <div className="flex min-w-0 grow flex-col gap-7 md:gap-9">{children}</div>
    </main>
  );
}
