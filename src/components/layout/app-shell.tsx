"use client";

import {
  Bell,
  BriefcaseBusiness,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Tags,
  Users,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/src/features/auth/actions";
import { can, type AuthRole } from "@/src/lib/auth/rbac";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/add", label: "Add Leads", icon: UserPlus },
  { href: "/followups", label: "Follow-ups", icon: CheckSquare2 },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/packages", label: "Packages", icon: BriefcaseBusiness },
  { href: "/tasks", label: "Tasks", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: AuthRole;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [leadsOpen, setLeadsOpen] = useState(pathname.startsWith("/leads"));
  const visibleNavItems = navItems.filter(
    (item) =>
      (item.href !== "/packages" || can(role, "packages.manage")) &&
      (item.href !== "/leads/add" || can(role, "leads.create")),
  );
  const selectedMarket =
    searchParams.get("market") === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC";

  useEffect(() => {
    const openPalette = () => setPaletteOpen(true);
    document.addEventListener("open-command-palette", openPalette);
    return () => document.removeEventListener("open-command-palette", openPalette);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl shadow-slate-950/10 transition-[width,transform] duration-200 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white shadow-sm">
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
            onClick={() => setMobileOpen(false)}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavItems.map((item) => {
            const active =
              item.href === "/leads"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            if (item.href === "/leads") {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    aria-expanded={leadsOpen}
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        setLeadsOpen(true);
                      } else {
                        setLeadsOpen((open) => !open);
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        <ChevronDown
                          className={`ml-auto h-4 w-4 transition-transform ${leadsOpen ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </button>
                  {leadsOpen && !collapsed && (
                    <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                      {[
                        { market: "DOMESTIC", label: "Domestic" },
                        { market: "INTERNATIONAL", label: "International" },
                      ].map((category) => {
                        const selected =
                          active && selectedMarket === category.market;
                        return (
                          <Link
                            key={category.market}
                            href={`/leads?market=${category.market}`}
                            onClick={() => setMobileOpen(false)}
                            aria-current={selected ? "page" : undefined}
                            className={`flex h-9 items-center rounded-lg px-3 text-sm transition-colors ${
                              selected
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            {category.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => void logoutAction()}
            className={`mb-1 hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive lg:flex ${
              collapsed ? "justify-center" : ""
            }`}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent lg:flex ${
              collapsed ? "justify-center" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-command-trigger
            className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm"
            onClick={() => document.dispatchEvent(new CustomEvent("open-command-palette"))}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search CRM</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              Ctrl K
            </kbd>
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Help">
            <CircleHelp className="h-4 w-4" />
          </button>
          <button type="button" className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <ThemeToggle />
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            SA
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search CRM">
          <button type="button" aria-label="Close search" className="absolute inset-0" onClick={() => setPaletteOpen(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads, customers, tasks..."
                className="h-14 flex-1 bg-transparent text-sm outline-none"
              />
              <kbd className="rounded border bg-muted px-2 py-1 text-[10px] text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-80 p-2">
              {visibleNavItems
                .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setPaletteOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-accent"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg border bg-background">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
