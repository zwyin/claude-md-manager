import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { I18nProvider } from "@/i18n";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { RoutedErrorBoundary } from "@/components/routed-error-boundary";
import { FontScaleProvider } from "@/components/font-scale-provider";
import { BackToTop } from "@/components/back-to-top";
import { ShortcutHelp } from "@/components/shortcut-help";
import { ScrollRestorer } from "@/components/scroll-restorer";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "CLAUDE.md Manager v0.2.0",
    template: "%s | CLAUDE.md Manager",
  },
  description: "CLAUDE.md Rule Management Dashboard / 规则管理面板",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geist.variable} antialiased`}>
      <body>
        <I18nProvider>
          <FontScaleProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <TopBar />
                <ScrollRestorer>
                  <div className="max-w-[1400px] mx-auto">
                    <RoutedErrorBoundary>
                      {children}
                    </RoutedErrorBoundary>
                  </div>
                </ScrollRestorer>
              </SidebarInset>
            </SidebarProvider>
            <BackToTop />
            <ShortcutHelp />
          </TooltipProvider>
          </FontScaleProvider>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
