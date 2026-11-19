import PixelDisplaceField from '@/v2/components/pixel-perfect/pixel-displace-field'

// Phase 0 shell: proves tokens, fonts, Tailwind and the shadcn pipeline. Chapters arrive in Phase 1.
export default function App() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-field-hero text-ink">
      <PixelDisplaceField className="absolute inset-0 opacity-60" />

      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col justify-between p-6 md:p-10">
        <header className="caption flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
            Tejas Govind
          </span>
          <span>Act 0 · Boot</span>
        </header>

        <section className="max-w-4xl">
          <p className="caption mb-4">sample 000 — the model, untrained</p>
          <h1 className="act-title text-6xl md:text-9xl">Training data</h1>
          <p className="mt-6 max-w-2xl text-2xl font-light md:text-4xl">
            Every model is what it was trained on. Mine was cricket, chai and{' '}
            <em className="font-serif text-accent">Bollywood.</em>
          </p>
        </section>

        <footer className="caption flex justify-between">
          <span>Scroll</span>
          <a className="pointer-events-auto underline-offset-4 hover:underline" href="/os/">
            The 2023 site →
          </a>
        </footer>
      </div>
    </main>
  )
}
