import Link from "next/link";

export function Pager({ page, hasMore, href }: { page: number; hasMore: boolean; href: (p: number) => string }) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label="Paginação" className="mt-4 flex justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="text-bone-dim hover:text-bone">← Anterior</Link> : <span />}
      <span className="text-faint">Página {page}</span>
      {hasMore ? <Link href={href(page + 1)} className="text-bone-dim hover:text-bone">Próxima →</Link> : <span />}
    </nav>
  );
}
