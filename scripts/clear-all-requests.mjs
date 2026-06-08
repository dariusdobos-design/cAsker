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

async function deleteAll(table, filterColumn = "created_at") {
  const { error } = await supabase
    .from(table)
    .delete()
    .gte(filterColumn, "1970-01-01");

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`${table} count: ${error.message}`);
  }
  return count ?? 0;
}

async function main() {
  const before = {
    requests: await countRows("requests"),
    appointments: await countRows("appointments"),
    proposals: await countRows("appointment_proposals"),
    notifications: await countRows("customer_notifications"),
  };

  console.log("Before:", before);

  await deleteAll("customer_notifications", "created_at");
  await deleteAll("appointment_proposals", "sent_at");
  await deleteAll("appointments", "created_at");
  await deleteAll("requests", "created_at");

  const after = {
    requests: await countRows("requests"),
    appointments: await countRows("appointments"),
    proposals: await countRows("appointment_proposals"),
    notifications: await countRows("customer_notifications"),
  };

  console.log("After:", after);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
