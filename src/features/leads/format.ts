export function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export function getWhatsAppUrl(phone: string | null | undefined) {
  if (!phone) return null;
  const rawDigits = phone.replace(/\D/g, "");
  const digits = rawDigits.startsWith("00") ? rawDigits.slice(2) : rawDigits;
  const localDigits =
    digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  const normalized = localDigits.length === 10 ? `91${localDigits}` : localDigits;
  return normalized ? `https://wa.me/${normalized}` : null;
}
