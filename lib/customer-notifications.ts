import { supabase } from "./supabase";
import type { Request } from "./requests";

export const COMPLETION_NOTIFICATION_TITLE = "Vaše vozidlo je hotové";

function buildCompletionNotificationBody(
  completedWork: string,
  vehiclePickupNote?: string,
) {
  const pickup = vehiclePickupNote?.trim();
  if (!pickup) return completedWork;
  return `${completedWork}\n\nPrevzatie vozidla: ${pickup}`;
}

export async function sendCustomerCompletionNotification(
  request: Request,
  completedWork: string,
  vehiclePickupNote?: string,
) {
  const body = buildCompletionNotificationBody(completedWork, vehiclePickupNote);

  const { error } = await supabase.from("customer_notifications").insert({
    request_id: request.id,
    customer_name: request.userName,
    customer_phone: request.phone,
    title: COMPLETION_NOTIFICATION_TITLE,
    body,
  });

  if (error) {
    if (error.code === "PGRST205" || error.code === "PGRST204") {
      console.info(
        `[cAsker] Notifikácia pre ${request.userName}: ${COMPLETION_NOTIFICATION_TITLE} – ${body}`,
      );
      return;
    }
    throw error;
  }
}
