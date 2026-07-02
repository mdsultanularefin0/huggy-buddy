import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type SearchDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

type ProductHit = { id: string; slug: string; name: string; image_url: string | null };
type ComboHit = { id: string; name: string; image_url: string | null };

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const term = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["search", term],
    enabled: open && term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const [{ data: products }, { data: combos }] = await Promise.all([
        supabase
          .from("products")
          .select("id,slug,name,image_url")
          .ilike("name", like)
          .limit(8),
        supabase
          .from("combos")
          .select("id,name,image_url")
          .ilike("name", like)
          .limit(5),
      ]);
      return {
        products: (products ?? []) as ProductHit[],
        combos: (combos ?? []) as ComboHit[],
      };
    },
    staleTime: 30_000,
  });

  const close = () => onOpenChange(false);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search fragrances, combos…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {term.length < 2 ? (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        ) : isFetching ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : (data?.products.length ?? 0) + (data?.combos.length ?? 0) === 0 ? (
          <CommandEmpty>No results for "{term}".</CommandEmpty>
        ) : null}

        {data?.products.length ? (
          <CommandGroup heading="Fragrances">
            {data.products.map((p) => (
              <CommandItem
                key={p.id}
                value={`product-${p.id}-${p.name}`}
                onSelect={() => {
                  close();
                  navigate({ to: "/product/$slug", params: { slug: p.slug } });
                }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                ) : (
                  <SearchIcon className="w-4 h-4 opacity-50" />
                )}
                <span>{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {data?.combos.length ? (
          <CommandGroup heading="Combos">
            {data.combos.map((c) => (
              <CommandItem
                key={c.id}
                value={`combo-${c.id}-${c.name}`}
                onSelect={() => {
                  close();
                  navigate({ to: "/combo/$id", params: { id: c.id } });
                }}
              >
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                ) : (
                  <SearchIcon className="w-4 h-4 opacity-50" />
                )}
                <span>{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
