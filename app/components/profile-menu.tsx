"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Store,
  User,
} from "lucide-react";
import { signOutCurrentUser } from "@/lib/companies";

type ProfileMenuProps = {
  onManageAccount?: () => void;
  onSubscription?: () => void;
  onLogout?: () => void;
  showNavigation?: boolean;
};

export function ProfileMenu({
  onManageAccount,
  onSubscription,
  onLogout,
  showNavigation = true,
}: ProfileMenuProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isHistoryPage = pathname === "/history";
  const isProfilePage = pathname === "/profile";
  const isAuthPage = pathname === "/auth";
  const showDashboardNavigation = showNavigation && !isAuthPage;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  const handleManageAccount = () => {
    closeMenu();
    if (onManageAccount) {
      onManageAccount();
      return;
    }
    router.push("/auth");
  };

  const handleSubscription = () => {
    closeMenu();
    if (onSubscription) {
      onSubscription();
      return;
    }
    router.push("/auth");
  };

  const handleLogout = () => {
    closeMenu();
    if (onLogout) {
      onLogout();
      return;
    }

    void (async () => {
      try {
        await signOutCurrentUser();
      } catch (error) {
        console.error("Odhlásenie zlyhalo:", error);
      } finally {
        router.push("/auth");
        router.refresh();
      }
    })();
  };

  return (
    <div className="casker-profile-menu" ref={menuRef}>
      <button
        type="button"
        className={`casker-profile-icon${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Profil"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <User className="h-4 w-4" strokeWidth={2.25} />
      </button>

      {isOpen ? (
        <div className="casker-profile-menu-dropdown" role="menu">
          {showDashboardNavigation ? (
            <>
              {isHistoryPage || isProfilePage ? (
                <Link
                  href="/"
                  className="casker-profile-menu-item"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <LayoutDashboard className="h-4 w-4" strokeWidth={2.25} />
                  Dashboard
                </Link>
              ) : null}
              {!isProfilePage ? (
                <Link
                  href="/profile"
                  className="casker-profile-menu-item"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <Store className="h-4 w-4" strokeWidth={2.25} />
                  Profil
                </Link>
              ) : null}
              {!isHistoryPage ? (
                <Link
                  href="/history"
                  className="casker-profile-menu-item"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <History className="h-4 w-4" strokeWidth={2.25} />
                  História dopytov
                </Link>
              ) : null}
            </>
          ) : null}

          <div
            className={
              showDashboardNavigation ? "mt-1 border-t border-zinc-200 pt-1" : undefined
            }
          >
            <button
              type="button"
              className="casker-profile-menu-item casker-profile-menu-button"
              role="menuitem"
              onClick={handleManageAccount}
            >
              <Settings className="h-4 w-4" strokeWidth={2.25} />
              Spravovať účet
            </button>
            <button
              type="button"
              className="casker-profile-menu-item casker-profile-menu-button"
              role="menuitem"
              onClick={handleSubscription}
            >
              <CreditCard className="h-4 w-4" strokeWidth={2.25} />
              Predplatné
            </button>
            <button
              type="button"
              className="casker-profile-menu-item casker-profile-menu-button"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" strokeWidth={2.25} />
              Odhlásiť sa
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
