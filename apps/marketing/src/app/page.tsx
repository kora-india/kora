import Link from "next/link";
import { GraduationCap, BarChart3, Shield, Smartphone, Users, CheckCircle } from "lucide-react";

const features = [
  { icon: Users, title: "Multi-School Management", desc: "One platform to run unlimited schools with full data isolation." },
  { icon: Smartphone, title: "Teacher PWA", desc: "Lightning-fast mobile attendance app — take attendance in 20 seconds." },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Revenue, attendance, and fee reports at a glance." },
  { icon: Shield, title: "Role-Based Access", desc: "Super Admin, School Admin, Teacher, Accountant — fine-grained permissions." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">SchoolOS</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="http://localhost:3000/login" className="text-sm text-gray-600 hover:text-gray-900">Admin Login</a>
          <a href="http://localhost:3001/login" className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">Teacher App</a>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full mb-6">
          ✦ V1 Now Available
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          The Modern<br />
          <span className="text-violet-600">School Management</span><br />
          Platform
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
          SchoolOS brings all your school operations into one elegant, fast, and powerful platform. Built for schools that demand the best.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="http://localhost:3000/login" className="inline-flex items-center justify-center h-12 px-8 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors">
            Get Started
          </a>
          <a href="#features" className="inline-flex items-center justify-center h-12 px-8 border rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            See Features
          </a>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Everything your school needs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 border rounded-2xl hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="px-6 py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Simple pricing</h2>
          <p className="text-gray-500 mb-10">One flat price per school, no per-student fees.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { plan: "Basic", price: "₹2,999", period: "/mo", features: ["Up to 500 students", "5 teachers", "Attendance & Fees"] },
              { plan: "Pro", price: "₹5,999", period: "/mo", features: ["Unlimited students", "Unlimited teachers", "Full analytics", "Priority support"], featured: true },
              { plan: "Enterprise", price: "Custom", period: "", features: ["Multiple branches", "White-labeling", "API access", "SLA"] },
            ].map((p) => (
              <div key={p.plan} className={`rounded-2xl p-6 text-left ${p.featured ? "bg-violet-600 text-white" : "bg-white border"}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${p.featured ? "text-violet-200" : "text-gray-400"}`}>{p.plan}</p>
                <p className="text-3xl font-bold">{p.price}<span className={`text-sm font-normal ${p.featured ? "text-violet-200" : "text-gray-400"}`}>{p.period}</span></p>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-sm text-gray-400">
        © 2025 SchoolOS · Built with Next.js 15, Turborepo & Prisma
      </footer>
    </div>
  );
}
