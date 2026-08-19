import Link from "next/link";
import { GraduationCap, BarChart3, Shield, Smartphone, Users, CheckCircle, ArrowRight, Zap, Sparkles } from "lucide-react";

const features = [
  { icon: Users, title: "Multi-School Management", desc: "One platform to run unlimited schools with full data isolation." },
  { icon: Smartphone, title: "Teacher PWA", desc: "Lightning-fast mobile attendance app — take attendance in 20 seconds." },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Revenue, attendance, and fee reports at a glance." },
  { icon: Shield, title: "Role-Based Access", desc: "Super Admin, School Admin, Teacher, Accountant — fine-grained permissions." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0118] text-white font-sans selection:bg-violet-500/30 overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/30 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[150px] rounded-full pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto backdrop-blur-md border-b border-white/5 rounded-b-2xl mb-12">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">SchoolOS</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Admin Login
          </Link>
          <a href="http://localhost:3001/login" className="text-sm bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-2.5 rounded-xl font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Teacher App
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 text-center px-6 pt-16 pb-24 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 rounded-full mb-8 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
          <Sparkles className="w-3.5 h-3.5" />
          V1 Now Available
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          The Modern<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">School Management</span><br />
          Platform
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          SchoolOS brings all your school operations into one elegant, fast, and powerful platform. Built for schools that demand the absolute best.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/login" className="group relative inline-flex items-center justify-center h-14 px-8 bg-white text-gray-900 font-bold rounded-2xl hover:bg-gray-50 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)] overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
          <a href="#features" className="inline-flex items-center justify-center h-14 px-8 bg-white/5 border border-white/10 rounded-2xl font-semibold hover:bg-white/10 transition-all text-white hover:scale-105 active:scale-95">
            Explore Features
          </a>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="relative z-10 px-6 py-24 border-t border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything your school needs</h2>
            <p className="text-white/50 max-w-xl mx-auto">A fully integrated suite of tools designed to automate administration and empower educators.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((f, i) => (
              <div key={f.title} className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300">
                <div className="w-12 h-12 bg-violet-500/20 text-violet-300 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{f.title}</h3>
                <p className="text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="relative z-10 px-6 py-24">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-white/50 mb-16 max-w-xl mx-auto">One flat price per school, no hidden per-student fees. Scale your institution without breaking the bank.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { plan: "Basic", price: "₹2,999", period: "/mo", features: ["Up to 500 students", "5 teachers", "Attendance & Fees"] },
              { plan: "Pro", price: "₹5,999", period: "/mo", features: ["Unlimited students", "Unlimited teachers", "Full analytics", "Priority support"], featured: true },
              { plan: "Enterprise", price: "Custom", period: "", features: ["Multiple branches", "White-labeling", "API access", "24/7 SLA"] },
            ].map((p) => (
              <div key={p.plan} className={`relative rounded-[2rem] p-8 text-left transition-transform hover:-translate-y-2 ${p.featured ? "bg-gradient-to-b from-violet-600 to-indigo-800 border border-violet-400/30 shadow-2xl shadow-violet-900/50" : "bg-white/5 border border-white/10"}`}>
                {p.featured && (
                  <div className="absolute top-0 right-8 -translate-y-1/2 bg-gradient-to-r from-amber-200 to-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <p className={`text-sm font-bold uppercase tracking-wider mb-4 ${p.featured ? "text-violet-200" : "text-white/50"}`}>{p.plan}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <p className="text-4xl font-extrabold">{p.price}</p>
                  <span className={`text-sm font-medium ${p.featured ? "text-violet-200" : "text-white/40"}`}>{p.period}</span>
                </div>
                <ul className="space-y-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm font-medium text-white/80">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${p.featured ? "bg-white/20 text-white" : "bg-white/10 text-white/70"}`}>
                        <CheckCircle className="w-3 h-3" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-8 border-t border-white/10">
                  <button className={`w-full py-4 rounded-xl font-bold transition-all active:scale-95 ${p.featured ? "bg-white text-indigo-900 hover:bg-gray-50 shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "bg-white/10 text-white hover:bg-white/20"}`}>
                    Select {p.plan}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/40 px-6 py-12 text-center text-sm text-white/40">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-white/60">Powered by Next.js 15 & Turborepo</span>
        </div>
        © 2025 SchoolOS Inc. All rights reserved.
      </footer>
    </div>
  );
}
