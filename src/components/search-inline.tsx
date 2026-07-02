import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ProductHit = { id: string; slug: string; name: string; image_url: string | null };
type ComboHit = { id: string; title: string; image_url: string | null };

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setFocused(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setFocused(false);
        onClose?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);



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

  const go = (fn: () => void) => {
    fn();
    setQuery("");
    setFocused(false);
    onClose?.();
  };

  const showDropdown = focused && term.length >= 2;
  const total = (data?.products.length ?? 0) + (data?.combos.length ?? 0);

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
              onClose?.();
            }
          }}
          placeholder="Search fragrances…"
          aria-label="Search"
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
        <div className="absolute right-0 left-0 mt-2 rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {isFetching && total === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Searching…</div>
          ) : total === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No results for "{term}".</div>
          ) : (
            <>
              {data?.products.length ? (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Fragrances</div>
                  {data.products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => go(() => navigate({ to: "/product/$slug", params: { slug: p.slug } }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                      ) : (
                        <SearchIcon className="w-4 h-4 opacity-50" />
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {data?.combos.length ? (
                <div className="py-1 border-t">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Combos</div>
                  {data.combos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(() => navigate({ to: "/combo/$id", params: { id: c.id } }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                    >
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                      ) : (
                        <SearchIcon className="w-4 h-4 opacity-50" />
                      )}
                      <span className="truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
