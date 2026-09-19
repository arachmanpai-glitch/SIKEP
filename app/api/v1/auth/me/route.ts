import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    return apiSuccess({
      userId: session.userId,
      email: session.email,
      roleCode: session.roleCode,
      schoolId: session.schoolId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
