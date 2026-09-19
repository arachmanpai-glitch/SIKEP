/**
 * Fixed role codes (spec section 3: "Hanya ada 3 role utama"). Unlike bill
 * types/fund sources/categories (deliberately NOT hard-coded, see D4),
 * roles are structural/security data, not configurable business master
 * data — the `roles` DB table exists for referential integrity (D12), and
 * this constant is what application code checks against so a typo can't
 * silently create a 4th, unenforced "role".
 */
export const ROLE_CODES = ["ADMIN", "BENDAHARA", "YAYASAN"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
