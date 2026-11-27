import { useState } from "react";

export function usePagination<T>(items: T[], filterKey = "", pageSize = 12) {
  const [selection, setSelection] = useState({ filterKey, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = selection.filterKey === filterKey ? Math.min(selection.page, pages) : 1;
  const offset = (page - 1) * pageSize;
  const goTo = (next: number) => setSelection({ filterKey, page: next });
  return {
    items: items.slice(offset, offset + pageSize),
    controls: pages > 1 && <nav className="pagination" aria-label="Paginación">
      <button type="button" className="button button-secondary button-small" disabled={page === 1} onClick={() => goTo(page - 1)}>Anterior</button>
      <span aria-live="polite">{offset + 1}–{Math.min(offset + pageSize, items.length)} de {items.length}</span>
      <button type="button" className="button button-secondary button-small" disabled={page === pages} onClick={() => goTo(page + 1)}>Siguiente</button>
    </nav>,
  };
}
