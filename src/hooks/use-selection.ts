import { useCallback, useMemo, useState } from "react";

export function useSelection<T extends { id: string }>(items: T[]) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => items.map((i) => i.id), [items]);
  const selectedIds = useMemo(
    () => visibleIds.filter((id) => ids.has(id)),
    [visibleIds, ids],
  );
  const selectedItems = useMemo(
    () => items.filter((i) => ids.has(i.id)),
    [items, ids],
  );

  const allChecked = visibleIds.length > 0 && selectedIds.length === visibleIds.length;
  const someChecked = selectedIds.length > 0 && !allChecked;

  const toggle = useCallback((id: string, checked?: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      const on = checked ?? !next.has(id);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [visibleIds]);

  const clear = useCallback(() => setIds(new Set()), []);
  const isSelected = useCallback((id: string) => ids.has(id), [ids]);

  return { selectedIds, selectedItems, isSelected, toggle, toggleAll, clear, allChecked, someChecked, count: selectedIds.length };
}
