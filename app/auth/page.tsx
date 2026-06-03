"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  accountToCompanyInput,
  createCompanyProfile,
  fetchCurrentCompanyProfile,
  formatAuthError,
} from "@/lib/companies";

const inputClassName =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClassName = "block text-sm font-medium text-gray-700";

function normalizeIco(value: string): string {
  return value.replace(/\D/g, "");
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="fixed inset-0 overflow-y-auto bg-slate-50 px-6 py-10">
          <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-center text-sm text-zinc-500">Načítavam…</p>
          </div>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [loginView, setLoginView] = useState<"login" | "forgot">("login");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isLoggedInWithoutProfile, setIsLoggedInWithoutProfile] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [ico, setIco] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [billingStreet, setBillingStreet] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [dic, setDic] = useState("");
  const [icDph, setIcDph] = useState("");
  const [operationStreet, setOperationStreet] = useState("");
  const [operationCity, setOperationCity] = useState("");
  const [operationZip, setOperationZip] = useState("");
  const [isFetchingCompany, setIsFetchingCompany] = useState(false);
  const [fetchCompanyError, setFetchCompanyError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("error") === "auth-callback") {
      setAuthError("Prihlásenie cez odkaz zlyhalo. Skúste to znova.");
    }
  }, [searchParams]);

  const clearAuthFeedback = () => {
    setAuthError(null);
    setAuthMessage(null);
  };

  const copyBillingAddress = () => {
    setOperationStreet(billingStreet);
    setOperationCity(billingCity);
    setOperationZip(billingZip);
  };

  const handleFetchCompany = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const normalizedIco = normalizeIco(ico);

    if (normalizedIco.length !== 8) {
      setFetchCompanyError("Zadajte platné IČO (8 číslic).");
      return;
    }

    setIsFetchingCompany(true);
    setFetchCompanyError(null);

    try {
      const response = await fetch(`/api/company/${normalizedIco}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Nepodarilo sa načítať údaje firmy.");
      }

      const company = (await response.json()) as {
        companyName: string;
        billingStreet: string;
        billingCity: string;
        billingZip: string;
        dic: string;
      };

      setIco(normalizedIco);
      setCompanyName(company.companyName);
      setBillingStreet(company.billingStreet);
      setBillingCity(company.billingCity);
      setBillingZip(company.billingZip);
      setDic(company.dic);
    } catch (error) {
      setFetchCompanyError(
        error instanceof Error ? error.message : "Nepodarilo sa načítať údaje firmy.",
      );
    } finally {
      setIsFetchingCompany(false);
    }
  };

  const handleStartRegistration = () => {
    clearAuthFeedback();
    setIsLoggedInWithoutProfile(false);
    setStep(2);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthFeedback();
    setIsAuthSubmitting(true);

    try {
      const supabase = createClient();
      const trimmedEmail = email.trim();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) throw signInError;

      const profile = await fetchCurrentCompanyProfile();

      if (!profile) {
        setEmail(trimmedEmail);
        setIsLoggedInWithoutProfile(true);
        setStep(2);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthFeedback();
    setIsAuthSubmitting(true);

    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setAuthError("Zadajte platný e-mail.");
        return;
      }

      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      setAuthMessage("Ak účet existuje, poslali sme vám e-mail s odkazom na obnovenie hesla.");
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const validateRegistration = (): boolean => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError("Zadajte platný e-mail.");
      return false;
    }

    if (!isLoggedInWithoutProfile) {
      if (password.length < 8) {
        setAuthError("Heslo musí mať aspoň 8 znakov.");
        return false;
      }

      if (password !== confirmPassword) {
        setAuthError("Heslá sa nezhodujú.");
        return false;
      }
    }

    if (!companyName.trim()) {
      setAuthError("Vyplňte obchodné meno firmy.");
      return false;
    }

    const serviceCity = operationCity.trim() || billingCity.trim();
    const serviceZip = operationZip.trim() || billingZip.trim();

    if (!serviceCity && !serviceZip) {
      setAuthError("Vyplňte mesto alebo PSČ prevádzky pre zobrazenie dopytov v okolí.");
      return false;
    }

    return true;
  };

  const handleCompleteRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthFeedback();

    if (!validateRegistration()) return;

    setIsAuthSubmitting(true);

    try {
      const supabase = createClient();
      const trimmedEmail = email.trim();
      let userId: string | null = null;

      if (isLoggedInWithoutProfile) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          setAuthError("Relácia vypršala. Prihláste sa znova.");
          setStep(1);
          setIsLoggedInWithoutProfile(false);
          return;
        }

        userId = user.id;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setAuthMessage(
            "Registrácia prebehla. Skontrolujte e-mail a potvrďte účet pred prihlásením.",
          );
          setStep(1);
          setPassword("");
          setConfirmPassword("");
          return;
        }

        userId = signUpData.user?.id ?? signUpData.session.user.id;
      }

      if (!userId) {
        throw new Error("Nepodarilo sa vytvoriť používateľský účet.");
      }

      await createCompanyProfile(
        userId,
        accountToCompanyInput({
          email: trimmedEmail,
          phone,
          ico,
          companyName,
          billingStreet,
          billingCity,
          billingZip,
          dic,
          icDph,
          operationStreet,
          operationCity,
          operationZip,
        }),
      );

      router.push("/");
      router.refresh();
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {step === 1 ? (
          loginView === "login" ? (
            <form className="space-y-4" onSubmit={(event) => void handleLogin(event)}>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Prihlásenie pre firmy</h1>
                <p className="mt-2 text-sm text-gray-600">Vitajte späť v cAsker</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className={labelClassName}>
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearAuthFeedback();
                  }}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className={labelClassName}>
                  Heslo
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearAuthFeedback();
                  }}
                  className={inputClassName}
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    clearAuthFeedback();
                    setLoginView("forgot");
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Zabudol som heslo
                </button>
              </div>

              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
              {authMessage ? <p className="text-sm text-green-700">{authMessage}</p> : null}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isAuthSubmitting ? "Prihlasujem…" : "Prihlásiť sa"}
                </button>
                <button
                  type="button"
                  onClick={handleStartRegistration}
                  disabled={isAuthSubmitting}
                  className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Zaregistrovať sa
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void handleForgotPassword(event)}>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Obnovenie hesla</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Zadajte e-mail a pošleme vám odkaz na nastavenie nového hesla.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="forgot-email" className={labelClassName}>
                  E-mail
                </label>
                <input
                  id="forgot-email"
                  name="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearAuthFeedback();
                  }}
                  className={inputClassName}
                />
              </div>

              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
              {authMessage ? <p className="text-sm text-green-700">{authMessage}</p> : null}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isAuthSubmitting ? "Odosielam…" : "Poslať resetovací odkaz"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthFeedback();
                    setLoginView("login");
                  }}
                  disabled={isAuthSubmitting}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Späť
                </button>
              </div>
            </form>
          )
        ) : (
          <form className="space-y-5" onSubmit={(event) => void handleCompleteRegistration(event)}>
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {isLoggedInWithoutProfile ? "Dokončenie registrácie" : "Registrácia firmy"}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {isLoggedInWithoutProfile
                  ? "Doplňte firemné údaje pre dokončenie účtu v cAsker."
                  : "Vytvorte prihlasovací účet a vyplňte firemné údaje pre cAsker."}
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Prihlasovacie údaje</h2>

              <div className="space-y-2">
                <label htmlFor="registerEmail" className={labelClassName}>
                  E-mail
                </label>
                <input
                  id="registerEmail"
                  name="registerEmail"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearAuthFeedback();
                  }}
                  readOnly={isLoggedInWithoutProfile}
                  className={`${inputClassName}${isLoggedInWithoutProfile ? " bg-gray-50" : ""}`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className={labelClassName}>
                  Telefónny kontakt
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    clearAuthFeedback();
                  }}
                  className={inputClassName}
                  placeholder="+421 900 000 000"
                />
              </div>

              {!isLoggedInWithoutProfile ? (
                <>
                  <div className="space-y-2">
                    <label htmlFor="registerPassword" className={labelClassName}>
                      Heslo
                    </label>
                    <input
                      id="registerPassword"
                      name="registerPassword"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        clearAuthFeedback();
                      }}
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className={labelClassName}>
                      Potvrdenie hesla
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        clearAuthFeedback();
                      }}
                      className={inputClassName}
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-gray-200 pt-5">
              <h2 className="text-lg font-semibold text-gray-900">Firemné údaje</h2>

              <div className="space-y-2">
                <label htmlFor="ico" className={labelClassName}>
                  IČO
                </label>
                <div className="flex gap-2">
                  <input
                    id="ico"
                    name="ico"
                    type="text"
                    inputMode="numeric"
                    value={ico}
                    onChange={(event) => {
                      setIco(event.target.value);
                      setFetchCompanyError(null);
                    }}
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    onClick={handleFetchCompany}
                    disabled={isFetchingCompany || isAuthSubmitting}
                    className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isFetchingCompany ? "Načítavam..." : "Načítať firmu"}
                  </button>
                </div>
                {fetchCompanyError ? (
                  <p className="text-sm text-red-600">{fetchCompanyError}</p>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="companyName" className={labelClassName}>
                    Obchodné meno
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="billingStreet" className={labelClassName}>
                    Ulica a číslo
                  </label>
                  <input
                    id="billingStreet"
                    name="billingStreet"
                    type="text"
                    value={billingStreet}
                    onChange={(event) => setBillingStreet(event.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="billingCity" className={labelClassName}>
                      Mesto
                    </label>
                    <input
                      id="billingCity"
                      name="billingCity"
                      type="text"
                      value={billingCity}
                      onChange={(event) => setBillingCity(event.target.value)}
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="billingZip" className={labelClassName}>
                      PSČ
                    </label>
                    <input
                      id="billingZip"
                      name="billingZip"
                      type="text"
                      value={billingZip}
                      onChange={(event) => setBillingZip(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="dic" className={labelClassName}>
                      DIČ <span className="font-normal text-gray-500">(voliteľné)</span>
                    </label>
                    <input
                      id="dic"
                      name="dic"
                      type="text"
                      value={dic}
                      onChange={(event) => setDic(event.target.value)}
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="icDph" className={labelClassName}>
                      IČ DPH <span className="font-normal text-gray-500">(voliteľné)</span>
                    </label>
                    <input
                      id="icDph"
                      name="icDph"
                      type="text"
                      value={icDph}
                      onChange={(event) => setIcDph(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-gray-200 pt-5">
              <h2 className="text-lg font-semibold text-gray-900">Adresa prevádzky</h2>

              <button
                type="button"
                onClick={copyBillingAddress}
                disabled={isAuthSubmitting}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Použiť fakturačnú adresu
              </button>

              <div className="space-y-2">
                <label htmlFor="operationStreet" className={labelClassName}>
                  Ulica
                </label>
                <input
                  id="operationStreet"
                  name="operationStreet"
                  type="text"
                  value={operationStreet}
                  onChange={(event) => setOperationStreet(event.target.value)}
                  className={inputClassName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="operationCity" className={labelClassName}>
                    Mesto
                  </label>
                  <input
                    id="operationCity"
                    name="operationCity"
                    type="text"
                    value={operationCity}
                    onChange={(event) => setOperationCity(event.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="operationZip" className={labelClassName}>
                    PSČ
                  </label>
                  <input
                    id="operationZip"
                    name="operationZip"
                    type="text"
                    value={operationZip}
                    onChange={(event) => setOperationZip(event.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
            {authMessage ? <p className="text-sm text-green-700">{authMessage}</p> : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearAuthFeedback();
                  setStep(1);
                  if (!isLoggedInWithoutProfile) return;
                  setIsLoggedInWithoutProfile(false);
                }}
                disabled={isAuthSubmitting}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Späť
              </button>
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAuthSubmitting
                  ? "Ukladám…"
                  : isLoggedInWithoutProfile
                    ? "Dokončiť registráciu"
                    : "Zaregistrovať sa"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
