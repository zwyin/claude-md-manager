import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { I18nProvider } from "@/i18n";
import { Toaster } from "@/components/ui/sonner";
import { RoutedErrorBoundary } from "@/components/routed-error-boundary";
import { FontScaleProvider } from "@/components/font-scale-provider";
import { BackToTop } from "@/components/back-to-top";
import { ShortcutHelp } from "@/components/shortcut-help";
import { GlobalShortcuts } from "@/components/global-shortcuts";
import { ScrollRestorer } from "@/components/scroll-restorer";

export const metadata: Metadata = {
  title: {
    default: "CLAUDE.md Manager v1.2.0",
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
    <html lang="zh-CN" className="antialiased">
      <body>
        <I18nProvider>
          <FontScaleProvider>
            <TooltipProvider>
              <div className="app-layout">
                <AppSidebar />
                <div className="main-content">
                  <TopBar />
                  <ScrollRestorer>
                    <RoutedErrorBoundary>
                      {children}
                    </RoutedErrorBoundary>
                  </ScrollRestorer>
                </div>
              </div>
              <BackToTop />
              <GlobalShortcuts />
              <ShortcutHelp />
            </TooltipProvider>
          </FontScaleProvider>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
