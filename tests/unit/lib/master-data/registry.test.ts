import { describe, expect, it } from "vitest";

import { MASTER_DATA_ENTITIES } from "@/lib/master-data/entities";
import { masterDataRegistry } from "@/lib/master-data/registry";
import { masterDataUiConfig } from "@/lib/master-data/ui-config";

describe("master-data registry/entities/ui-config stay in sync", () => {
  it("the server registry has exactly one entry per declared slug", () => {
    expect(Object.keys(masterDataRegistry).sort()).toEqual([...MASTER_DATA_ENTITIES].sort());
  });

  it("the client ui-config has exactly one entry per declared slug", () => {
    expect(Object.keys(masterDataUiConfig).sort()).toEqual([...MASTER_DATA_ENTITIES].sort());
  });

  it("every ui-config entry has at least one field", () => {
    for (const slug of MASTER_DATA_ENTITIES) {
      expect(masterDataUiConfig[slug].fields.length).toBeGreaterThan(0);
    }
  });

  it("registry and ui-config labels agree for every slug", () => {
    for (const slug of MASTER_DATA_ENTITIES) {
      expect(masterDataRegistry[slug].label).toBe(masterDataUiConfig[slug].label);
    }
  });
});
