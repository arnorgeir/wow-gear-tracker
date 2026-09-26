export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Finish setup</h1>
      <p className="text-muted">The app needs Battle.net API credentials before it can load characters.</p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Create a client at <a href="https://community.developer.battle.net/access/clients">community.developer.battle.net</a>.</li>
        <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>.</li>
        <li>Fill in: <code className="font-mono">{missing.join(', ')}</code>.</li>
        <li>Restart <code className="font-mono">npm run dev</code>.</li>
      </ol>
      <p className="text-muted">The README has the full steps.</p>
    </main>
  );
}
