"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) { toast.error("Invalid credentials"); return; }
    toast.success("Welcome!");
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900 px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">SchoolOS Teacher</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your teacher account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-3xl border p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu"
              className="w-full h-12 px-4 rounded-2xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full h-12 px-4 pr-12 rounded-2xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-12 bg-violet-600 text-white rounded-2xl font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            Sign in
          </button>
        </form>
        <div className="mt-4 p-4 bg-card/70 rounded-2xl border">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Demo credentials</p>
          <p className="text-xs">priya@dps.edu.in / teacher123</p>
        </div>
      </div>
    </div>
  );
}
