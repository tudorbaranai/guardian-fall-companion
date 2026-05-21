"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import logo from "../../../public/logo.png";
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GridIcon,
  HistoryIcon,
  SettingsIcon,
} from "./icons";

const SIDEBAR_COLLAPSED_KEY = "guardian.sidebar.collapsed";

type IconType = ComponentType<{ size?: number; sw?: number }>;

interface NavItem {
  href: string;
  label: string;
  Icon: IconType;
}

/** Persistent destinations — visible on every screen, never hidden.
 *  The fall alert is not a destination: it surfaces as a modal over any page. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", Icon: GridIcon },
  { href: "/motion", label: "Motion", Icon: ActivityIcon },
  { href: "/history", label: "Fall history", Icon: HistoryIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Persistent bottom tab bar for mobile. Each target is at least 56px tall and
 * always shows icon + label together.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-navy/10 bg-surface px-2 pb-7 pt-2.5 lg:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center gap-1 py-1.5",
              active ? "text-navy" : "text-ink-3",
            )}
          >
            <Icon size={26} sw={active ? 2.1 : 1.7} />
            <span
              className={cn(
                "text-[13px] tracking-[0.02em]",
                active ? "font-bold" : "font-normal",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Desktop sidebar — replaces the bottom tab bar on wide screens, with the
 * same four destinations plus product and caregiver identity.
 */
export function Sidebar() {
  const pathname = usePathname();
  // Collapsed state persists across reloads via localStorage. We start
  // expanded on the server and during the first client paint to avoid a
  // hydration mismatch; the stored preference is applied right after mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") {
        window.setTimeout(() => setCollapsed(true), 0);
      }
    } catch {
      /* localStorage unavailable (private mode etc.) — keep default */
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* best-effort */
      }
      return next;
    });
  };

  // ⌘\ / Ctrl+\ toggles the sidebar — matches VS Code, Cursor, and Linear.
  // Ignore the shortcut while the user is typing in an input or textarea,
  // and while a modifier-key combo would shadow a normal text-edit action.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!cmdOrCtrl || e.shiftKey || e.altKey) return;
      if (e.key !== "\\") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Show the platform-correct shortcut hint in the tooltip. Default to the
  // Ctrl form so SSR + first paint match; swap to ⌘ on Mac after mount.
  const [shortcut, setShortcut] = useState("Ctrl+\\");
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform)
    ) {
      window.setTimeout(() => setShortcut("⌘\\"), 0);
    }
  }, []);

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        // overflow-visible (no overflow-y-auto) is required so the
        // edge-handle collapse button can stick out past the right border.
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-0.5 self-start border-r border-navy/10 bg-surface py-6 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[76px] px-2" : "w-[256px] px-4",
      )}
    >
      {/* Brand mark — replace /logo.png in /public with your own asset.
          SVG / WEBP work too; update the src extension if you change it. */}
      <div
        className={cn(
          "flex items-center gap-2.5 pb-4",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        <Image
          src={logo}
          alt="Guardian"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0"
          priority
        />
        {!collapsed && (
          <div className="text-[26px] uppercase text-navy">Guardian</div>
        )}
      </div>

      {/* Edge-handle toggle — a small squared button that straddles the
          sidebar's right border, vertically centered on the logo. The
          sidebar's sticky positioning establishes a containing block for
          this absolute child; `right-0 translate-x-1/2` puts the button's
          center exactly on the right border line — half over the menu,
          half over the canvas next to it. */}
      <button
        type="button"
        onClick={toggle}
        title={`${collapsed ? "Expand" : "Collapse"} menu (${shortcut})`}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-keyshortcuts="Control+\\ Meta+\\"
        aria-expanded={!collapsed}
        className="absolute right-0 top-[30px] z-10 flex h-7 w-7 translate-x-1/2 items-center justify-center rounded-md border border-navy/15 bg-surface text-ink-2 shadow-sm transition-colors hover:border-navy hover:bg-navy hover:text-[#eaf1f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
      >
        {collapsed ? (
          <ChevronRightIcon size={14} sw={2.4} />
        ) : (
          <ChevronLeftIcon size={14} sw={2.4} />
        )}
      </button>

      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-lg text-[15px]",
              collapsed ? "justify-center px-0" : "px-4",
              active
                ? "bg-navy font-bold text-[#eaf1f8]"
                : "font-normal text-ink-2 hover:bg-navy/8",
            )}
          >
            <Icon size={20} sw={active ? 2.1 : 1.7} />
            {!collapsed && label}
          </Link>
        );
      })}


      <div
        className={cn(
          "mt-auto flex items-center gap-2.5 border-t border-navy/10 pt-3",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy/8 text-[14px] font-bold text-navy">
          S
        </div>
        {!collapsed && (
          <div>
            <div className="text-[14px] font-bold leading-tight text-ink">
              Sofia Popescu
            </div>
            <div className="text-[11px] text-ink-3">Caregiver</div>
          </div>
        )}
      </div>
    </aside>
  );
}
