import type { MasterDataEntitySlug } from "@/lib/master-data/entities";

export interface MasterDataFieldConfig {
  name: string;
  label: string;
  type: "text" | "money" | "boolean" | "select" | "date";
  options?: readonly { value: string; label: string }[];
  required?: boolean;
  /** Shown under the field — used for the two FK-by-id fields below, since
   * this minimal admin UI doesn't cross-fetch related lists for a dropdown
   * (documented limitation, see docs/step4/00-progress.md). */
  help?: string;
}

export interface MasterDataUiConfig {
  label: string;
  fields: readonly MasterDataFieldConfig[];
}

const CLASS_LEVEL_OPTIONS = [
  { value: "K1", label: "Kelas 1" },
  { value: "K2", label: "Kelas 2" },
  { value: "K3", label: "Kelas 3" },
  { value: "K4", label: "Kelas 4" },
  { value: "K5", label: "Kelas 5" },
  { value: "K6", label: "Kelas 6" },
  { value: "PENGABDIAN", label: "Pengabdian" },
] as const;

export const masterDataUiConfig: Record<MasterDataEntitySlug, MasterDataUiConfig> = {
  "academic-years": {
    label: "Tahun Ajaran",
    fields: [
      { name: "name", label: "Nama (mis. 2026/2027)", type: "text", required: true },
      { name: "startDate", label: "Tanggal Mulai", type: "date", required: true },
      { name: "endDate", label: "Tanggal Selesai", type: "date", required: true },
      { name: "isActive", label: "Aktif", type: "boolean" },
    ],
  },
  classes: {
    label: "Kelas",
    fields: [
      {
        name: "academicYearId",
        label: "ID Tahun Ajaran",
        type: "text",
        required: true,
        help: "Salin dari halaman Tahun Ajaran.",
      },
      {
        name: "level",
        label: "Tingkat",
        type: "select",
        options: CLASS_LEVEL_OPTIONS,
        required: true,
      },
      { name: "name", label: "Nama Kelas", type: "text", required: true },
    ],
  },
  "financial-accounts": {
    label: "Akun Keuangan",
    fields: [
      { name: "name", label: "Nama Akun", type: "text", required: true },
      {
        name: "type",
        label: "Tipe",
        type: "select",
        options: [
          { value: "CASH", label: "Kas" },
          { value: "BANK", label: "Bank" },
        ],
        required: true,
      },
      { name: "accountNumber", label: "Nomor Rekening", type: "text" },
      { name: "openingBalance", label: "Saldo Awal", type: "money" },
      { name: "isActive", label: "Aktif", type: "boolean" },
    ],
  },
  "fund-sources": {
    label: "Sumber Dana",
    fields: [
      { name: "name", label: "Nama Sumber Dana", type: "text", required: true },
      { name: "description", label: "Deskripsi", type: "text" },
      { name: "isActive", label: "Aktif", type: "boolean" },
    ],
  },
  "transaction-categories": {
    label: "Kategori Transaksi",
    fields: [
      { name: "name", label: "Nama Kategori", type: "text", required: true },
      {
        name: "type",
        label: "Tipe",
        type: "select",
        options: [
          { value: "INCOME", label: "Pemasukan" },
          { value: "EXPENSE", label: "Pengeluaran" },
        ],
        required: true,
      },
      { name: "requiresApproval", label: "Wajib Approval", type: "boolean" },
      { name: "isActive", label: "Aktif", type: "boolean" },
    ],
  },
  "bill-types": {
    label: "Jenis Tagihan",
    fields: [
      { name: "name", label: "Nama Jenis Tagihan", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "boolean" },
    ],
  },
};
