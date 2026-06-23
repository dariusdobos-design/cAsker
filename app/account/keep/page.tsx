"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type KeepAccountState =
  | { status: "loading" }
  | { status: "success"; alreadyCancelled: boolean }
  | { status: "error"; message: string };

export default function KeepAccountPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<KeepAccountState>({ status: "loading" });

  useEffect(() => {
    const token = searchParams.get("token")?.trim() ?? "";
    if (!token) {
      setState({ status: "error", message: "Odkaz je neplatný alebo expirovaný." });
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/account/keep?token=${encodeURIComponent(token)}`);
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; result?: { alreadyCancelled?: boolean } }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Požiadavku sa nepodarilo zrušiť.");
        }

        setState({
          status: "success",
          alreadyCancelled: Boolean(payload?.result?.alreadyCancelled),
        });
      } catch (error) {
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Požiadavku sa nepodarilo zrušiť.",
        });
      }
    })();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">cAsker</p>

        {state.status === "loading" ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-casker-navy">Spracovávam…</h1>
            <p className="mt-2 text-sm text-slate-600">Rušíme požiadavku na odstránenie účtu.</p>
          </>
        ) : null}

        {state.status === "success" ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-casker-navy">Účet zostáva aktívny</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {state.alreadyCancelled
                ? "Požiadavka na odstránenie účtu už bola skôr zrušená."
                : "Požiadavka na odstránenie účtu bola úspešne zrušená. Váš účet zostáva aktívny."}
            </p>
          </>
        ) : null}

        {state.status === "error" ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-casker-navy">Odkaz nefunguje</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{state.message}</p>
          </>
        ) : null}
      </div>
    </main>
  );
}
