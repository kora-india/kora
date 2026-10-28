import Link from "next/link";
import Image from "next/image";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <Image
        src="/kora-icon.png"
        alt="Kora"
        width={48}
        height={48}
        className="h-12 w-12 object-contain mb-6"
      />

      <h1 className="text-7xl font-bold text-muted-foreground/20 mb-2">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page not found</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or you may not have
        permission to view it.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Go to Dashboard
        </Link>
        <Link
          href="javascript:history.back()"
          className="flex items-center gap-2 h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Link>
      </div>
    </div>
  );
}
