"use client";

import {
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/src/features/auth/actions";
import { can, type AuthRole } from "@/src/lib/auth/rbac";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/add", label: "Add Leads", icon: UserPlus },
  { href: "/packages", label: "Packages", icon: BriefcaseBusiness },
];

export function AppShell({
  children,
  role,
  userName,
}: {
  children: React.ReactNode;
  role: AuthRole;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const [paletteOpenPath, setPaletteOpenPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const mobileOpen = mobileOpenPath === pathname;
  const paletteOpen = paletteOpenPath === pathname;
  const collapsed = !sidebarHovered && !sidebarFocused && !mobileOpen;
  const visibleNavItems = navItems.filter(
    (item) =>
      (item.href !== "/packages" || can(role, "packages.manage")) &&
      (item.href !== "/leads/add" || can(role, "leads.create")),
  );
  const matchingNavItems = visibleNavItems.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase()),
  );
  const openPalette = useCallback(() => {
    setSearch("");
    setActiveResultIndex(0);
    setPaletteOpenPath(pathname);
  }, [pathname]);
  const userInitials =
    userName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  useEffect(() => {
    document.addEventListener("open-command-palette", openPalette);
    return () => document.removeEventListener("open-command-palette", openPalette);
  }, [openPalette]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") {
        setPaletteOpenPath(null);
        setMobileOpenPath(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette]);

  useEffect(() => {
    const closeNavigationOverlays = () => {
      setMobileOpenPath(null);
      setPaletteOpenPath(null);
    };
    window.addEventListener("popstate", closeNavigationOverlays);
    return () => window.removeEventListener("popstate", closeNavigationOverlays);
  }, []);

  return (
    <div
      className="min-h-screen bg-background"
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest("a[href]")) {
          setMobileOpenPath(null);
          setPaletteOpenPath(null);
        }
      }}
    >
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          aria-controls="primary-navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpenPath(null)}
        />
      )}
      <aside
        id="primary-navigation"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => {
          setSidebarHovered(false);
          setSidebarFocused(false);
        }}
        onFocus={() => setSidebarFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setSidebarFocused(false);
          }
        }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl shadow-slate-950/10 transition-[width,transform] duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-[260px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white shadow-sm">
            <Image
              src="/assets/logo.svg"
              alt="JMT"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">JMT CRM</p>
              <p className="truncate text-xs text-sidebar-foreground/65">Workspace</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileOpenPath(null)}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Workspace
            </p>
          )}
          {visibleNavItems.map((item) => {
            const active =
              item.href === "/leads"
                ? pathname === item.href ||
                  (pathname.startsWith(`${item.href}/`) && !pathname.startsWith("/leads/add"))
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpenPath(null)}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm ring-1 ring-inset ring-sidebar-border"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && active && (
                  <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => void logoutAction()}
            className={`mb-1 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive ${
              collapsed ? "justify-center" : ""
            }`}
            aria-label="Sign out"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-300 ease-in-out ${collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpenPath(pathname)}
            className="grid h-9 w-9 place-items-center rounded-lg border lg:hidden"
            aria-label="Open sidebar"
            aria-controls="primary-navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-command-trigger
            aria-label="Open page navigation"
            aria-keyshortcuts="Control+K Meta+K"
            className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            onClick={openPalette}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Jump to a page</span>
            <kbd className="ml-auto hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              Ctrl K
            </kbd>
          </button>
          <ThemeToggle />
          <div className="hidden min-w-0 text-right sm:block">
            <p className="max-w-40 truncate text-xs font-semibold">{userName}</p>
            <p className="text-[10px] text-muted-foreground">{role.replaceAll("_", " ")}</p>
          </div>
          <div
            role="img"
            aria-label={`Signed in as ${userName}`}
            title={userName}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-primary/15"
          >
            {userInitials}
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Page navigation">
          <button type="button" aria-label="Close search" className="absolute inset-0" onClick={() => setPaletteOpenPath(null)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                aria-label="Search pages"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveResultIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && matchingNavItems.length > 0) {
                    event.preventDefault();
                    setActiveResultIndex((index) => (index + 1) % matchingNavItems.length);
                  }
                  if (event.key === "ArrowUp" && matchingNavItems.length > 0) {
                    event.preventDefault();
                    setActiveResultIndex(
                      (index) => (index - 1 + matchingNavItems.length) % matchingNavItems.length,
                    );
                  }
                  if (event.key === "Enter" && matchingNavItems[activeResultIndex]) {
                    event.preventDefault();
                    router.push(matchingNavItems[activeResultIndex].href);
                    setPaletteOpenPath(null);
                  }
                }}
                placeholder="Search available pages..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded border bg-muted px-2 py-1 text-[10px] text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {matchingNavItems.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No matching pages.
                </p>
              ) : (
                matchingNavItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setPaletteOpenPath(null)}
                      onMouseMove={() => setActiveResultIndex(index)}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                        index === activeResultIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg border bg-background shadow-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{item.label}</span>
                      {pathname === item.href && (
                        <span className="ml-auto text-xs text-muted-foreground">Current page</span>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
            <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-[10px] text-muted-foreground">
              <span><kbd className="rounded border bg-background px-1 py-0.5 font-mono">↑</kbd> <kbd className="rounded border bg-background px-1 py-0.5 font-mono">↓</kbd> to navigate</span>
              <span><kbd className="rounded border bg-background px-1 py-0.5 font-mono">Enter</kbd> to open</span>
              <span className="ml-auto">JMT CRM</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
