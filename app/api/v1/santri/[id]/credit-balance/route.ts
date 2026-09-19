import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/rbac";
import { getCreditBalance } from "@/services/CreditService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const result = await getCreditBalance(session, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
