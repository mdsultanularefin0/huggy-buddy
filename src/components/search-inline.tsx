import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ProductHit = { id: string; slug: string; name: string; image_url: string | null };
type ComboHit = { id: string; title: string; image_url: string | null };
type FlatHit =
  | { kind: "product"; id: string; label: string; image_url: string | null; slug: string }
  | { kind: "combo"; id: string; label: string; image_url: string | null };

export function SearchInline({
  className,
  autoFocus,
  onClose,
}: {
  className?: string;
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setFocused(true);
    }
  }, [autoFocus]);

  // Outside-click handling is owned by the parent (which knows about the
  // trigger button); we only handle focus/blur here so the dropdown collapses
  // when the input loses focus within the same overlay.


  const term = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["search", term],
    enabled: term.length >= 1,
    queryFn: async () => {
      const like = `%${term}%`;
      const [productsRes, combosRes] = await Promise.all([
        supabase
          .from("products")
          .select("id,slug,name,image_url")
          .eq("is_active", true)
          .ilike("name", like)
          .limit(6),
        supabase
          .from("combos")
          .select("id,title,image_url")
          .eq("is_active", true)
          .ilike("title", like)
          .limit(4),
      ]);
      if (productsRes.error) console.error("[search] products:", productsRes.error);
      if (combosRes.error) console.error("[search] combos:", combosRes.error);
      return {
        products: (productsRes.data ?? []) as ProductHit[],
        combos: (combosRes.data ?? []) as ComboHit[],
      };
    },
    staleTime: 30_000,
  });

  const flat = useMemo<FlatHit[]>(() => {
    const p: FlatHit[] = (data?.products ?? []).map((x) => ({
      kind: "product",
      id: x.id,
      label: x.name,
      image_url: x.image_url,
      slug: x.slug,
    }));
    const c: FlatHit[] = (data?.combos ?? []).map((x) => ({
      kind: "combo",
      id: x.id,
      label: x.title,
      image_url: x.image_url,
    }));
    return [...p, ...c];
  }, [data]);

  useEffect(() => {
    setActiveIdx(0);
  }, [term, flat.length]);

  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const go = (fn: () => void) => {
    fn();
    setQuery("");
    setFocused(false);
    onClose?.();
  };

  const selectHit = (h: FlatHit) => {
    if (h.kind === "product") {
      go(() => navigate({ to: "/product/$slug", params: { slug: h.slug } }));
    } else {
      go(() => navigate({ to: "/combo/$id", params: { id: h.id } }));
    }
  };

  const showDropdown = focused && term.length >= 1;
  const total = flat.length;

  const registerRef = (idx: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[idx] = el;
  };

  let productStart = 0;
  let comboStart = data?.products.length ?? 0;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 h-10 px-3 rounded-full bg-white/10 focus-within:bg-white/15 transition-colors">
        <SearchIcon className="w-4 h-4 opacity-80" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setFocused(false);
              onClose?.();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const hit = showDropdown ? flat[activeIdx] : undefined;
              if (hit) {
                selectHit(hit);
              } else if (term.length >= 1) {
                go(() => navigate({ to: "/products", search: { q: term } as never }));
              }
              return;
            }
            if (!showDropdown || total === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % total);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + total) % total);
            } else if (e.key === "Home") {
              e.preventDefault();
              setActiveIdx(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setActiveIdx(total - 1);
            }
          }}
          placeholder="Search fragrances…"
          aria-label="Search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-listbox"
          aria-activedescendant={showDropdown && flat[activeIdx] ? `search-hit-${activeIdx}` : undefined}
          className="bg-transparent outline-none text-sm w-full placeholder:text-primary-foreground/60 text-primary-foreground"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="search-listbox"
          role="listbox"
          className="absolute right-0 left-0 mt-2 rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
        >
          {isFetching && total === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Searching…</div>
          ) : total === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No results for "{term}".</div>
          ) : (
            <>
              {data?.products.length ? (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Fragrances</div>
                  {data.products.map((p, i) => {
                    const idx = productStart + i;
                    const active = idx === activeIdx;
                    return (
                      <button
                        key={p.id}
                        id={`search-hit-${idx}`}
                        ref={registerRef(idx)}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => go(() => navigate({ to: "/product/$slug", params: { slug: p.slug } }))}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <SearchIcon className="w-4 h-4 opacity-50" />
                        )}
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {data?.combos.length ? (
                <div className="py-1 border-t">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Combos</div>
                  {data.combos.map((c, i) => {
                    const idx = comboStart + i;
                    const active = idx === activeIdx;
                    return (
                      <button
                        key={c.id}
                        id={`search-hit-${idx}`}
                        ref={registerRef(idx)}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => go(() => navigate({ to: "/combo/$id", params: { id: c.id } }))}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        {c.image_url ? (
                          <img src={c.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <SearchIcon className="w-4 h-4 opacity-50" />
                        )}
                        <span className="truncate">{c.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
