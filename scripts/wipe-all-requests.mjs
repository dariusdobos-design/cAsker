import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing env file
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ARCHIVED_STATUSES = ["inquiry", "waiting", "done", "completed", "cancelled"];

async function countRequestsByStatus() {
  const { data, error } = await supabase.from("requests").select("status");
  if (error) {
    throw new Error(error.message);
  }

  const counts = {};
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

async function expireAllRequests() {
  const updatedAt = new Date().toISOString();

  for (const status of ARCHIVED_STATUSES) {
    const { error } = await supabase
      .from("requests")
      .update({ status: "expired", updated_at: updatedAt })
      .eq("status", status);

    if (error) {
      throw new Error(`requests (${status} -> expired): ${error.message}`);
    }
  }
}

async function detachAppointments() {
  const { error } = await supabase
    .from("appointments")
    .update({ request_id: null })
    .not("request_id", "is", null);

  if (error) {
    throw new Error(`appointments (detach request_id): ${error.message}`);
  }
}

async function main() {
  console.log("Before:", await countRequestsByStatus());
  await expireAllRequests();
  await detachAppointments();
  console.log("After:", await countRequestsByStatus());
  console.log("Hotovo. Dashboard aj apka by mali byť prázdne po obnovení.");
  console.log(
    "Pre úplné vymazanie riadkov z DB spustite supabase/clear-all-requests.sql v Supabase SQL editore.",
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
