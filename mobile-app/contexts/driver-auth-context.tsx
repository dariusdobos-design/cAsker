import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { isDriverLoggedIn, loginDriverSession, logoutDriverSession } from "@/lib/driver-session";

type DriverAuthContextValue = {
  isLoggedIn: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const DriverAuthContext = createContext<DriverAuthContextValue | null>(null);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const loggedIn = await isDriverLoggedIn();
      if (active) {
        setIsLoggedIn(loggedIn);
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    await loginDriverSession();
    setIsLoggedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await logoutDriverSession();
    setIsLoggedIn(false);
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      isLoading,
      signIn,
      signOut,
    }),
    [isLoading, isLoggedIn, signIn, signOut],
  );

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

export function useDriverAuth() {
  const context = useContext(DriverAuthContext);
  if (!context) {
    throw new Error("useDriverAuth must be used within DriverAuthProvider");
  }
  return context;
}
