/** Shared money formatting + the PRD price band (Rp 12.000 – Rp 15.000). */
export const SESSION_PASS_PRICE = 12000;
export const SESSION_PASS_PRICE_FALLBACK = SESSION_PASS_PRICE;

export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function sessionDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes >= 60 ? `${Math.round(minutes / 60)} jam` : `${minutes} menit`;
}
