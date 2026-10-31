/** The one support staff job that signs in to Kora. */
export const isAccountant = (occupation: string | null | undefined) =>
  occupation?.trim().toLowerCase() === "accountant";
