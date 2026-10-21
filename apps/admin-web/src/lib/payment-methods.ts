/** Every payment method the database accepts, with the label staff see. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "DEBIT_CARD", label: "Debit card" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "ONLINE", label: "Online" },
  { value: "OTHER", label: "Other" },
] as const;
