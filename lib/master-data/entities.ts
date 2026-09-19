/**
 * Single source of truth for the 6 generic master-data entity slugs — kept
 * in its own file (no server-only imports) so it can be imported from
 * BOTH the server registry (lib/master-data/registry.ts, which pulls in
 * Prisma-touching repositories) and client components (lib/master-data/
 * ui-config.ts, rendered in the browser). `registry.ts` types its object
 * literal as `Record<MasterDataEntitySlug, ...>`, so TypeScript itself
 * enforces that every slug here has a matching registry entry.
 */
export const MASTER_DATA_ENTITIES = [
  "academic-years",
  "classes",
  "financial-accounts",
  "fund-sources",
  "transaction-categories",
  "bill-types",
] as const;

export type MasterDataEntitySlug = (typeof MASTER_DATA_ENTITIES)[number];

export function isMasterDataEntitySlug(value: string): value is MasterDataEntitySlug {
  return (MASTER_DATA_ENTITIES as readonly string[]).includes(value);
}
