"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, GraduationCap } from "lucide-react";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginInput = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        return;
      }

      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0ibTM2IDM0djZoNnYtNnptLTEyIDB2Nmg2di02em0wLTEydjZoNnYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SchoolOS</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Modern School<br />Management Platform
          </h1>
          <p className="text-violet-200 text-lg leading-relaxed">
            Everything your school needs in one elegant, powerful platform.
          </p>
        </div>
        <div className="relative space-y-4">
          {[
            { label: "Delhi Public School", users: "1,284 students", status: "Pro" },
            { label: "Greenfield Academy", users: "856 students", status: "Basic" },
          ].map((school) => (
            <div key={school.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between border border-white/10">
              <div>
                <p className="text-white text-sm font-medium">{school.label}</p>
                <p className="text-violet-200 text-xs">{school.users}</p>
              </div>
              <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">{school.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">SchoolOS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your school dashboard</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email address</label>
              <input
                {...register("email")}
                type="email"
                placeholder="admin@school.edu.in"
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Sign in
            </button>
          </form>

          <div className="mt-6 p-4 bg-muted/40 rounded-xl border">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Demo credentials</p>
            <div className="space-y-1 text-xs">
              <p><span className="font-medium">Admin:</span> admin@dps.edu.in / admin123</p>
              <p><span className="font-medium">Teacher:</span> priya@dps.edu.in / teacher123</p>
              <p><span className="font-medium">Super:</span> super@schoolos.com / admin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
