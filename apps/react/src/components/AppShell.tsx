import logoUrl from '@orbitq/assets/orbitq-logo.svg'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-grid bg-orbitq-900 text-orbitq-50 font-grotesk">
      <header className="bg-orbitq-900 border-b border-orbitq-700 px-6 h-14 flex items-center shrink-0">
        <img src={logoUrl} alt="OrbitQ" className="h-5 w-auto" />
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}
