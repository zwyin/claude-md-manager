import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CLAUDE.md Manager",
  description: "CLAUDE.md rule management dashboard",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/rules", label: "Rules", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/analytics", label: "Analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full flex bg-[#f7f8fc]">
        {/* Sidebar - fixed */}
        <aside className="w-56 h-screen bg-[#1a1a2e] flex flex-col flex-shrink-0 fixed left-0 top-0 bottom-0 z-10">
          {/* Logo */}
          <div className="px-5 py-4 border-b border-white/10">
            <h1 className="text-lg font-bold text-white tracking-wide">
              CLAUDE.md
            </h1>
            <p className="text-xs text-[#a0aec0] mt-0.5">
              Rule Management Dashboard
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3 space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#a0aec0] hover:bg-[#16213e] hover:text-[#e2e8f0] transition-colors"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/10">
            <p className="text-xs text-[#718096]">
              v0.1.0
            </p>
          </div>
        </aside>

        {/* Main content - scrollable, offset by sidebar width */}
        <main className="flex-1 ml-56 h-screen overflow-y-auto">
          <div className="p-6 max-w-[1400px]">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
