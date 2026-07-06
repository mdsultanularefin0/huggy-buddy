# Pre-launch Audit — cPanel Deployment

Date: 2026-07-06
Scope: full project scan — TypeScript, ESLint, runtime errors, dependency CVEs, Supabase security linter, backend security scan.

## ✅ Clean

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit`) | **0 errors** |
| Runtime errors (browser) | **None captured** |
| Dependency vulnerabilities (`npm audit`) | **0 high/critical** |
| Build tooling / config | OK |

## ⚠️ Findings

### 1. React Rules of Hooks — FIXED
- **File:** `src/routes/product.$slug.tsx` (was line 196)
- `useRef` was called **after** an early `if (!product) return null;`, violating hooks order and risking a runtime crash if `product` toggles between renders.
- **Action taken:** moved `addingRef = useRef(false)` up next to the other hooks, before the early return.

### 2. React Rules of Hooks — cosmetic (safe)
- **File:** `src/routes/invoice.$id.tsx:24`
- ESLint warns that `useRouter` is called inside `errorComponent`. This is a false positive — TanStack Router `errorComponent` **is** a React component; lint just can't tell from the lowercase prop name. No change required.

### 3. `useMemo` dependency shape — low risk
- **File:** `src/routes/admin.orders.index.tsx:86` (dep of `useMemo` at 154)
- The `orders` logical expression could re-create every render. Non-blocking, admin-only page. Leave for now or wrap in its own `useMemo`.

### 4. `@typescript-eslint/no-explicit-any` — 15 occurrences
Non-blocking; typecheck passes. Cleanup candidates:
- `src/components/meta-pixel-loader.tsx` (3)
- `src/lib/checkout.functions.ts` (3)
- `src/lib/email.functions.ts` (3)
- `src/routes/admin.products.tsx` (4)
- Others (2)

### 5. `prefer-const` — 2 trivial
- `src/components/search-inline.tsx:126-127` — `productStart`, `comboStart` should be `const`.

### 6. Prettier formatting — 3499 auto-fixable
Cosmetic only. Run `bunx eslint . --fix` if you want a clean report. Does **not** affect the build or the deploy.

### 7. React Fast Refresh warnings — 7 in shadcn/ui files
Files export both components and constants (button variants, badge variants, etc.). This is the stock shadcn pattern; it only affects HMR in dev, not the production build. **Ignore.**

## 🔒 Backend security (Supabase linter + security scan)

All **warn**-level, no critical. Review before launch:

1. **RLS policy always true** — a policy uses `USING (true)` / `WITH CHECK (true)` on a mutating op (UPDATE/DELETE/INSERT). Find it and tighten to `auth.uid()` scope.
2. **SECURITY DEFINER function callable by authenticated role** — revoke `EXECUTE` from `authenticated` or switch to `SECURITY INVOKER` if signed-in users shouldn't call it.
3. **Storage bucket `review-images`** — policy `"Authenticated users upload review images"` has no ownership `WITH CHECK`. Any signed-in user can upload arbitrary paths. Add `(storage.foldername(name))[1] = auth.uid()::text` or similar.
4. **Order lookup by phone** — `users read own orders` policy matches on `customer_json->>'phone'` against the user's profile phone. If two users share/register the same phone, one can read the other's orders. Restrict to verified/unique identifiers or drop the phone fallback.

## 📦 cPanel deployment notes

- `CPANEL_DEPLOYMENT.txt` exists at repo root — review before shipping.
- TanStack Start SSR/edge target: confirm the cPanel host runs the built artifact correctly (Node/edge). Static-only cPanel won't serve server functions.
- Verify `.env` values for the production host: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, any webhook/HMAC secrets.
- `src/routes/api/public/mail.sync.ts` is guarded by the anon apikey — make sure your cron sender uses the correct header.

## Suggested pre-launch checklist

- [x] Fix hook-order bug in `product.$slug.tsx`
- [ ] Address the 4 Supabase security warnings above
- [ ] (Optional) `bunx eslint . --fix` to clean formatting noise
- [ ] Smoke test: checkout, invoice download, admin order flow, email send
- [ ] Confirm production env vars in cPanel
