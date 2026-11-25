export default function Loading() {
  return (
    <div role="status" className="grid min-h-screen place-items-center bg-background">
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
