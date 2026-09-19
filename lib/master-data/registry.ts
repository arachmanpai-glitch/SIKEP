import type { MasterDataEntitySlug } from "@/lib/master-data/entities";
import {
  academicYearAdapter,
  billTypeAdapter,
  classAdapter,
  financialAccountAdapter,
  fundSourceAdapter,
  transactionCategoryAdapter,
} from "@/repositories/masterDataAdapters";
import { createMasterDataService } from "@/services/masterDataService";
import {
  academicYearCreateSchema,
  academicYearUpdateSchema,
  billTypeCreateSchema,
  billTypeUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  financialAccountCreateSchema,
  financialAccountUpdateSchema,
  fundSourceCreateSchema,
  fundSourceUpdateSchema,
  transactionCategoryCreateSchema,
  transactionCategoryUpdateSchema,
} from "@/lib/validation/master-data";

/**
 * URL slug -> { service, schemas, label } for the 6 structurally-identical
 * master-data entities. Drives both the dynamic API routes
 * (app/api/v1/master-data/[entity]/**) and the dynamic Admin UI page
 * (app/admin/master-data/[entity]/page.tsx). Santri, users, and
 * approval-settings are NOT here — they have dedicated routes/services.
 */
export const masterDataRegistry = {
  "academic-years": {
    label: "Tahun Ajaran",
    service: createMasterDataService(academicYearAdapter),
    createSchema: academicYearCreateSchema,
    updateSchema: academicYearUpdateSchema,
  },
  classes: {
    label: "Kelas",
    service: createMasterDataService(classAdapter),
    createSchema: classCreateSchema,
    updateSchema: classUpdateSchema,
  },
  "financial-accounts": {
    label: "Akun Keuangan",
    service: createMasterDataService(financialAccountAdapter),
    createSchema: financialAccountCreateSchema,
    updateSchema: financialAccountUpdateSchema,
  },
  "fund-sources": {
    label: "Sumber Dana",
    service: createMasterDataService(fundSourceAdapter),
    createSchema: fundSourceCreateSchema,
    updateSchema: fundSourceUpdateSchema,
  },
  "transaction-categories": {
    label: "Kategori Transaksi",
    service: createMasterDataService(transactionCategoryAdapter),
    createSchema: transactionCategoryCreateSchema,
    updateSchema: transactionCategoryUpdateSchema,
  },
  "bill-types": {
    label: "Jenis Tagihan",
    service: createMasterDataService(billTypeAdapter),
    createSchema: billTypeCreateSchema,
    updateSchema: billTypeUpdateSchema,
  },
} satisfies Record<
  MasterDataEntitySlug,
  { label: string; service: unknown; createSchema: unknown; updateSchema: unknown }
>;

export { isMasterDataEntitySlug } from "@/lib/master-data/entities";
