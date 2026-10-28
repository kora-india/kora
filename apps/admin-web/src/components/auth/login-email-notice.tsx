import { MailCheck, MailWarning } from "lucide-react";

/**
 * Shown with a new login's temporary password: whether its sign-in details
 * reached the person's inbox, and what happens next.
 */
export function LoginEmailNotice({
  emailed,
  email,
}: Readonly<{ emailed: boolean; email: string }>) {
  if (emailed) {
    return (
      <p
        role="status"
        className="flex gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3"
      >
        <MailCheck className="w-4 h-4 flex-shrink-0" aria-hidden />
        <span>
          We&apos;ve emailed the sign-in details to <strong>{email}</strong>.
          They&apos;ll choose their own password the first time they sign in.
          This password won&apos;t be shown again.
        </span>
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="flex gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
    >
      <MailWarning className="w-4 h-4 flex-shrink-0" aria-hidden />
      <span>
        We couldn&apos;t email <strong>{email}</strong>. Save this password now
        and pass it on yourself; it won&apos;t be shown again. They&apos;ll
        choose their own password the first time they sign in.
      </span>
    </p>
  );
}
