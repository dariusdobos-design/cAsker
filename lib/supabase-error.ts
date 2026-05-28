export function getSupabaseErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Neznáma chyba Supabase";
  }

  const supabaseError = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  return (
    supabaseError.message ||
    supabaseError.details ||
    supabaseError.hint ||
    (supabaseError.code ? `Supabase error ${supabaseError.code}` : "Neznáma chyba Supabase")
  );
}
