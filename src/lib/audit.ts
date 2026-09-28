import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | string | null,
  detail?: string,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      detail: detail ?? null,
    });
  } catch (err) {
    console.error("audit failed", err);
  }
}
