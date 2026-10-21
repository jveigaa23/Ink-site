/**
 * Elementos gráficos de tinta (SVG). Puramente decorativos: aria-hidden.
 * Não representam trabalhos do estúdio.
 */
export function InkStroke({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" fill="none" aria-hidden="true" className={`ink-draw ${className}`}>
      <path
        style={{ ["--len" as string]: 1900 }}
        d="M312 70c-118 6-226 96-236 226-9 117 74 228 204 236 140 9 248-92 246-226-2-108-80-190-170-200-78-9-150 46-156 124-5 66 44 120 108 118 52-1 86-42 82-88"
        stroke="var(--bone)"
        strokeOpacity=".9"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        style={{ ["--len" as string]: 700 }}
        d="M120 520c80-40 190-58 330-36"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="452" cy="486" r="3" fill="var(--accent)" />
    </svg>
  );
}

export function InkDivider({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true" className={`h-3 w-full ${className}`}>
      <path d="M2 7c60-6 120 3 190-1s140-5 206 0" stroke="var(--ink-600)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
