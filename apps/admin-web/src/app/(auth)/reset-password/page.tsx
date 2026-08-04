import { ResetPasswordContent } from "@/components/auth/reset-password-content";

export const metadata = { title: "Reset Password" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <ResetPasswordContent token={token ?? ""} />;
}
