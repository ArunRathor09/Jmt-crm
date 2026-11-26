"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Archive, MoreHorizontal, Trash2, X } from "lucide-react";
import { permanentlyDeleteLeadAction } from "./actions";

function DeleteLeadButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
      {pending ? "Deleting lead..." : "Permanently delete"}
    </button>
  );
}

export function LeadDeleteMenu({
  leadId,
  leadName,
}: {
  leadId: string;
  leadName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuButtonRef.current?.contains(event.target) &&
        !menuPanelRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => setMenuOpen(false);

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmOpen(false);
        setConfirmation("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [confirmOpen]);

  const closeConfirmation = () => {
    setConfirmOpen(false);
    setConfirmation("");
  };

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const trigger = menuButtonRef.current;
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    const menuHeight = 104;
    const top =
      window.innerHeight - bounds.bottom >= menuHeight + 8
        ? bounds.bottom + 8
        : Math.max(8, bounds.top - menuHeight - 8);
    setMenuPosition({
      top,
      right: Math.max(8, window.innerWidth - bounds.right),
    });
    setMenuOpen(true);
  };

  return (
    <>
      <div>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={`More actions for ${leadName}`}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? `lead-actions-${leadId}` : undefined}
          onClick={toggleMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuPanelRef}
            id={`lead-actions-${leadId}`}
            style={menuPosition}
            className="fixed z-[70] w-56 max-w-[calc(100vw-1rem)] rounded-xl border bg-card p-1.5 shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmation("");
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Permanently delete
            </button>
            <button
              type="button"
              disabled
              title="Move to trash will be available later"
              className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground opacity-60"
            >
              <Archive aria-hidden="true" className="h-4 w-4" />
              <span>Move to trash</span>
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">
                Later
              </span>
            </button>
          </div>,
          document.body,
        )}

      {confirmOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
            <button
              type="button"
              aria-label="Cancel lead deletion"
              className="absolute inset-0"
              onClick={closeConfirmation}
            />
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`delete-lead-title-${leadId}`}
              aria-describedby={`delete-lead-description-${leadId}`}
              className="relative z-10 w-full max-w-md rounded-t-2xl border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    id={`delete-lead-title-${leadId}`}
                    className="text-base font-semibold"
                  >
                    Permanently delete this lead?
                  </h2>
                  <p
                    id={`delete-lead-description-${leadId}`}
                    className="mt-1 break-words text-sm text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{leadName}</span>{" "}
                    and its lead history will be permanently removed. Linked
                    customers and tasks will be kept.
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Cancel lead deletion"
                  onClick={closeConfirmation}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <form action={permanentlyDeleteLeadAction} className="mt-5 space-y-4">
                <input type="hidden" name="leadId" value={leadId} />
                <label
                  htmlFor={`confirm-delete-${leadId}`}
                  className="block text-xs font-medium text-muted-foreground"
                >
                  Type <span className="font-semibold text-foreground">{leadName}</span>{" "}
                  to confirm.
                </label>
                <input
                  id={`confirm-delete-${leadId}`}
                  name="confirmName"
                  required
                  autoComplete="off"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeConfirmation}
                    className="h-10 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <DeleteLeadButton enabled={confirmation.trim() === leadName} />
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
