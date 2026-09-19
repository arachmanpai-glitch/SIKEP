import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/AuditService", () => ({
  recordAudit: vi.fn(),
}));

import { recordAudit } from "@/services/AuditService";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSameSchool } from "@/lib/rbac";
import {
  createMasterDataService,
  type MasterDataAdapter,
  type MasterDataRecord,
} from "@/services/masterDataService";

interface Widget extends MasterDataRecord {
  id: string;
  schoolId: string;
  name: string;
}

const SESSION = {
  userId: "user-1",
  schoolId: "school-a",
  roleCode: "ADMIN",
  email: "admin@sikep.test",
};

function buildAdapter(seed: Widget[]) {
  const store = new Map(seed.map((w) => [w.id, w]));
  let nextId = seed.length + 1;

  const adapter: MasterDataAdapter<Widget, { name: string }, { name?: string }> = {
    entityLabel: "Widget",
    findMany: async (schoolId) => [...store.values()].filter((w) => w.schoolId === schoolId),
    findById: async (schoolId, id) => {
      const record = store.get(id);
      return record && record.schoolId === schoolId ? record : null;
    },
    create: async (schoolId, data) => {
      const record: Widget = { id: `w${nextId++}`, schoolId, name: data.name };
      store.set(record.id, record);
      return record;
    },
    update: async (schoolId, id, data) => {
      const existing = store.get(id)!;
      const updated = { ...existing, ...data };
      store.set(id, updated);
      return updated;
    },
    softDelete: async (schoolId, id) => {
      const existing = store.get(id)!;
      const deleted = { ...existing, name: `${existing.name} (nonaktif)` };
      store.set(id, deleted);
      return deleted;
    },
  };
  return { adapter, store };
}

describe("services/masterDataService generic engine", () => {
  beforeEach(() => {
    vi.mocked(recordAudit).mockReset();
  });

  it("list() only returns records belonging to the session's school (tenant isolation)", async () => {
    const { adapter } = buildAdapter([
      { id: "w1", schoolId: "school-a", name: "A" },
      { id: "w2", schoolId: "school-b", name: "B" },
    ]);
    const service = createMasterDataService(adapter);

    const result = await service.list(SESSION);
    expect(result).toEqual([{ id: "w1", schoolId: "school-a", name: "A" }]);
  });

  it("create() persists the record and writes a CREATE audit entry", async () => {
    const { adapter } = buildAdapter([]);
    const service = createMasterDataService(adapter);

    const record = await service.create(SESSION, { name: "New Widget" });

    expect(record.name).toBe("New Widget");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "Widget", entityId: record.id }),
    );
  });

  it("update() throws NotFoundError for a nonexistent id", async () => {
    const { adapter } = buildAdapter([]);
    const service = createMasterDataService(adapter);
    await expect(service.update(SESSION, "missing", { name: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("update() on a record owned by another school looks like NotFoundError, not ForbiddenError (IDOR: don't leak existence across tenants)", async () => {
    const { adapter } = buildAdapter([{ id: "w1", schoolId: "school-b", name: "Other Tenant" }]);
    const service = createMasterDataService(adapter);
    await expect(service.update(SESSION, "w1", { name: "hacked" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("requireSameSchool itself still throws ForbiddenError when called directly with a mismatched schoolId (defense-in-depth backstop, see lib/rbac.ts)", () => {
    expect(() => requireSameSchool(SESSION, "school-b")).toThrow(ForbiddenError);
  });

  it("update() persists changes and writes an UPDATE audit entry with old/new values", async () => {
    const { adapter } = buildAdapter([{ id: "w1", schoolId: "school-a", name: "Old Name" }]);
    const service = createMasterDataService(adapter);

    const updated = await service.update(SESSION, "w1", { name: "New Name" });

    expect(updated.name).toBe("New Name");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entityType: "Widget",
        entityId: "w1",
        oldValues: expect.objectContaining({ name: "Old Name" }),
        newValues: expect.objectContaining({ name: "New Name" }),
      }),
    );
  });

  it("remove() soft-deletes and audits as UPDATE (spec's AuditAction enum has no DELETE)", async () => {
    const { adapter } = buildAdapter([{ id: "w1", schoolId: "school-a", name: "Doomed" }]);
    const service = createMasterDataService(adapter);

    const result = await service.remove(SESSION, "w1");

    expect(result.name).toContain("nonaktif");
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE" }));
  });

  it("remove() throws NotFoundError for a nonexistent id, without calling softDelete", async () => {
    const { adapter } = buildAdapter([]);
    const softDeleteSpy = vi.spyOn(adapter, "softDelete");
    const service = createMasterDataService(adapter);

    await expect(service.remove(SESSION, "missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(softDeleteSpy).not.toHaveBeenCalled();
  });
});
