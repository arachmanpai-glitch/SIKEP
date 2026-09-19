/** Seed list per spec section 5 — configurable afterwards via Admin UI
 * (bill_types is a normal table, not an enum, see D4/D13). */
export const DEFAULT_BILL_TYPE_NAMES = [
  "Syahriyah",
  "PSB",
  "Daftar Ulang",
  "Perpus",
  "Buku Paket",
  "Qurban",
  "MKS",
  "PAS",
  "PAT",
  "Ziarah / Study Tour",
  "Wisuda",
  "PHBI",
] as const;
