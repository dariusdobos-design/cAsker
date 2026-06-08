import { supabase } from "./supabase";

export type RequestMessageSenderRole = "service" | "customer";

export type RequestMessage = {
  id: string;
  requestId: string;
  senderRole: RequestMessageSenderRole;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const MESSAGE_SELECT_FIELDS =
  "id, request_id, sender_role, body, created_at, customer_read_at, service_read_at";

function mapMessageRow(row: Record<string, unknown>): RequestMessage {
  const senderRole = row.sender_role as RequestMessageSenderRole;
  const customerReadAt = (row.customer_read_at as string | null) ?? null;
  const serviceReadAt = (row.service_read_at as string | null) ?? null;

  return {
    id: String(row.id),
    requestId: String(row.request_id),
    senderRole,
    body: String(row.body),
    createdAt: String(row.created_at),
    readAt: senderRole === "service" ? customerReadAt : serviceReadAt,
  };
}

export async function fetchRequestMessages(requestId: string): Promise<RequestMessage[]> {
  const { data, error } = await supabase
    .from("request_messages")
    .select(MESSAGE_SELECT_FIELDS)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "PGRST205") {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>));
}

export async function sendRequestMessage(
  requestId: string,
  senderRole: RequestMessageSenderRole,
  body: string,
): Promise<RequestMessage> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Správa nemôže byť prázdna.");
  }

  const { data, error } = await supabase
    .from("request_messages")
    .insert({
      request_id: requestId,
      sender_role: senderRole,
      body: trimmed,
    })
    .select(MESSAGE_SELECT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return mapMessageRow(data as Record<string, unknown>);
}

export async function markRequestMessagesReadByService(requestId: string) {
  const { error } = await supabase
    .from("request_messages")
    .update({ service_read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .eq("sender_role", "customer")
    .is("service_read_at", null);

  if (error && error.code !== "PGRST205") {
    throw error;
  }
}

export async function markRequestMessagesReadByCustomer(requestId: string) {
  const { error } = await supabase
    .from("request_messages")
    .update({ customer_read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .eq("sender_role", "service")
    .is("customer_read_at", null);

  if (error && error.code !== "PGRST205") {
    throw error;
  }
}

export async function countUnreadRequestMessagesForCustomer(requestIds: string[]) {
  if (requestIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("request_messages")
    .select("request_id")
    .in("request_id", requestIds)
    .eq("sender_role", "service")
    .is("customer_read_at", null);

  if (error) {
    if (error.code === "PGRST205") {
      return new Map<string, number>();
    }
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const requestId = String((row as { request_id: string }).request_id);
    counts.set(requestId, (counts.get(requestId) ?? 0) + 1);
  }

  return counts;
}

export async function countUnreadRequestMessagesForService(requestIds: string[]) {
  if (requestIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("request_messages")
    .select("request_id")
    .in("request_id", requestIds)
    .eq("sender_role", "customer")
    .is("service_read_at", null);

  if (error) {
    if (error.code === "PGRST205") {
      return new Map<string, number>();
    }
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const requestId = String((row as { request_id: string }).request_id);
    counts.set(requestId, (counts.get(requestId) ?? 0) + 1);
  }

  return counts;
}
