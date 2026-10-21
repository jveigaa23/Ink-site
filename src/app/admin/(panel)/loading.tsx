/** Esqueleto exibido instantaneamente ao navegar entre páginas do painel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded-sm bg-ink-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-sm bg-ink-900" />
        ))}
      </div>
      <div className="h-64 rounded-sm bg-ink-900" />
    </div>
  );
}
