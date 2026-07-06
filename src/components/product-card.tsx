import { Link } from "@tanstack/react-router";

import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";

export type ProductCardData = {
  slug: string;
  name: string;
  image_url: string | null;
  regular_price: number;
  sale_price: number | null;
  sizes_json?: { size_label: string; price: number; sale_price?: number | null }[] | null;
  badge?: string | null;
  in_stock?: boolean | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const min = product.sizes_json?.[0];
  const reg = min?.price ?? product.regular_price;
  const sale = min?.sale_price ?? product.sale_price;
  const onSale = hasSale(reg, sale);
  const price = effectivePrice(reg, sale);
  const outOfStock = product.in_stock === false;

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group relative block bg-[#f5edff] rounded-3xl transition-shadow duration-500 hover:shadow-[0_30px_60px_-15px_rgba(82,39,122,0.25)]"
    >
      {(product.badge || onSale) && !outOfStock && (
        <span className="absolute -top-2 -left-2 sm:-top-3 sm:-left-3 md:-top-4 md:-left-4 z-10 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-red-600 text-white flex items-center justify-center text-[7px] sm:text-[8px] md:text-[10px] font-bold tracking-widest uppercase shadow-lg ring-2 sm:ring-4 ring-white">
          {product.badge || "Sale"}
        </span>
      )}


      <div className={`relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#ece2f7] ${outOfStock ? "opacity-70" : ""}`}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-[#ece2f7]" aria-hidden="true" />
        )}


        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-red-600 text-white px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-full shadow-lg">
              Out of stock
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-0 translate-y-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
            <span className="bg-white/95 backdrop-blur-sm text-[#52277a] px-8 py-3 text-[10px] font-bold tracking-[0.2em] uppercase rounded-full border border-[#52277a]/10 group-hover:bg-[#52277a] group-hover:text-white transition-colors duration-300">
              View Details
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-6 text-center">
        <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-2 font-medium">
          Veloura Essence
        </p>
        <h3 className="text-base text-[#1a1a1a] mb-3 leading-tight font-serif truncate">
          {product.name}
        </h3>
        <div className="flex items-center justify-center gap-3">
          {onSale && (
            <span className="text-xs text-gray-400 line-through font-light">{formatBDT(reg)}</span>
          )}
          <span className={`text-sm font-semibold ${onSale ? "text-[#a555f0]" : "text-[#52277a]"}`}>
            {formatBDT(price)}
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-0 bg-[#a555f0] transition-all duration-500 group-hover:w-1/2"></div>
    </Link>
  );
}
