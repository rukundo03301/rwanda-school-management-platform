export function formatRwf(amount) {
  const value = Number(amount || 0);
  if (!Number.isSafeInteger(value)) throw new Error("Invalid RWF amount");
  return "RWF " + new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(value);
}

export function paymentSummary(invoices = [], payments = []) {
  // All stored money amounts are integers representing whole RWF, never floats.
  const billed = invoices.reduce((sum, i) => sum + (i.status === "void" ? 0 : Number(i.amount_rwf || 0)), 0);
  const collected = payments.reduce((sum, p) => sum + (p.status === "settled" ? Number(p.amount_rwf || 0) : 0), 0);
  if (![billed, collected].every(Number.isSafeInteger)) throw new Error("Financial total exceeds safe integer range");
  return { billedRwf: billed, collectedRwf: collected, unallocatedDifferenceRwf: billed - collected };
}
