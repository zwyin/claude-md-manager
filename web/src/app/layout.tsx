import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { I18nProvider } from "@/i18n";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CLAUDE.md Manager",
  description: "CLAUDE.md 规则管理面板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geist.variable} antialiased`}>
      <body>
        <I18nProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <TopBar />
                <main className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-[1400px] mx-auto">
                    {children}
                  </div>
                </main>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
