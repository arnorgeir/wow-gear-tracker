import { SettingsNav } from '@/components/settings-nav/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <SettingsNav />
      {children}
    </main>
  );
}
