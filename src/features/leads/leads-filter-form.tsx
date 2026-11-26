"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";

export function LeadsFilterForm({
  action,
  className,
  children,
}: {
  action: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (typeof value === "string" && value.length > 0) query.set(key, value);
    });

    const search = query.toString();
    const href = search ? `/leads?${search}#lead-summary` : "/leads#lead-summary";
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className={`${className} transition-opacity ${isPending ? "pointer-events-none opacity-65" : ""}`}
      role="search"
      aria-label="Filter leads"
      aria-busy={isPending}
    >
      {children}
      {isPending && (
        <span className="sr-only" role="status" aria-live="polite">
          Updating lead results
        </span>
      )}
    </form>
  );
}
