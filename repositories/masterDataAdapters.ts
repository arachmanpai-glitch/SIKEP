import { prisma } from "@/lib/prisma";
import type { MasterDataAdapter } from "@/services/masterDataService";
import type {
  AcademicYearCreateInput,
  AcademicYearUpdateInput,
  BillTypeCreateInput,
  BillTypeUpdateInput,
  ClassCreateInput,
  ClassUpdateInput,
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput,
  FundSourceCreateInput,
  FundSourceUpdateInput,
  TransactionCategoryCreateInput,
  TransactionCategoryUpdateInput,
} from "@/lib/validation/master-data";
import type {
  AcademicYear,
  BillType,
  Class,
  FinancialAccount,
  FundSource,
  TransactionCategory,
} from "@prisma/client";

export const academicYearAdapter: MasterDataAdapter<
  AcademicYear,
  AcademicYearCreateInput,
  AcademicYearUpdateInput
> = {
  entityLabel: "Tahun Ajaran",
  findMany: (schoolId) =>
    prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: "desc" } }),
  findById: (schoolId, id) => prisma.academicYear.findFirst({ where: { id, schoolId } }),
  create: (schoolId, data) => prisma.academicYear.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.academicYear.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.academicYear.update({ where: { id, schoolId }, data: { isActive: false } }),
};

export const classAdapter: MasterDataAdapter<Class, ClassCreateInput, ClassUpdateInput> = {
  entityLabel: "Kelas",
  findMany: (schoolId) =>
    prisma.class.findMany({ where: { schoolId, deletedAt: null }, orderBy: { name: "asc" } }),
  findById: (schoolId, id) => prisma.class.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.class.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.class.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.class.update({ where: { id, schoolId }, data: { deletedAt: new Date() } }),
};

export const financialAccountAdapter: MasterDataAdapter<
  FinancialAccount,
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput
> = {
  entityLabel: "Akun Keuangan",
  findMany: (schoolId) =>
    prisma.financialAccount.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
  findById: (schoolId, id) =>
    prisma.financialAccount.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.financialAccount.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.financialAccount.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.financialAccount.update({
      where: { id, schoolId },
      data: { deletedAt: new Date(), isActive: false },
    }),
};

export const fundSourceAdapter: MasterDataAdapter<
  FundSource,
  FundSourceCreateInput,
  FundSourceUpdateInput
> = {
  entityLabel: "Sumber Dana",
  findMany: (schoolId) =>
    prisma.fundSource.findMany({ where: { schoolId, deletedAt: null }, orderBy: { name: "asc" } }),
  findById: (schoolId, id) =>
    prisma.fundSource.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.fundSource.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.fundSource.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.fundSource.update({
      where: { id, schoolId },
      data: { deletedAt: new Date(), isActive: false },
    }),
};

export const transactionCategoryAdapter: MasterDataAdapter<
  TransactionCategory,
  TransactionCategoryCreateInput,
  TransactionCategoryUpdateInput
> = {
  entityLabel: "Kategori Transaksi",
  findMany: (schoolId) =>
    prisma.transactionCategory.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
  findById: (schoolId, id) =>
    prisma.transactionCategory.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.transactionCategory.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) =>
    prisma.transactionCategory.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.transactionCategory.update({
      where: { id, schoolId },
      data: { deletedAt: new Date(), isActive: false },
    }),
};

export const billTypeAdapter: MasterDataAdapter<
  BillType,
  BillTypeCreateInput,
  BillTypeUpdateInput
> = {
  entityLabel: "Jenis Tagihan",
  findMany: (schoolId) =>
    prisma.billType.findMany({ where: { schoolId, deletedAt: null }, orderBy: { name: "asc" } }),
  findById: (schoolId, id) =>
    prisma.billType.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.billType.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.billType.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.billType.update({
      where: { id, schoolId },
      data: { deletedAt: new Date(), isActive: false },
    }),
};
