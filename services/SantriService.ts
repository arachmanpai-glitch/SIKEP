import { santriAdapter } from "@/repositories/SantriRepository";
import { createMasterDataService } from "@/services/masterDataService";

export const santriService = createMasterDataService(santriAdapter);
