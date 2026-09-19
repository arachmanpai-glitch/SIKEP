import { notFound } from "next/navigation";

import { MasterDataAdminClient } from "@/components/admin/MasterDataAdminClient";
import { isMasterDataEntitySlug } from "@/lib/master-data/entities";

interface PageProps {
  params: Promise<{ entity: string }>;
}

export default async function MasterDataAdminPage({ params }: PageProps) {
  const { entity } = await params;
  if (!isMasterDataEntitySlug(entity)) {
    notFound();
  }
  return <MasterDataAdminClient entity={entity} />;
}
