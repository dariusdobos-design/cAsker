"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, LayoutDashboard, User } from "lucide-react";

export function ProfileMenu() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isHistoryPage = pathname === "/history";

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
          {isHistoryPage ? (
            <Link
              href="/"
              className="casker-profile-menu-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" strokeWidth={2.25} />
              Dashboard
            </Link>
          ) : (
            <Link
              href="/history"
              className="casker-profile-menu-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <History className="h-4 w-4" strokeWidth={2.25} />
              História dopytov
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
