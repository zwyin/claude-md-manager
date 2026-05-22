'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, PenLine, Clock, BarChart3 } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useFetch } from "@/hooks/use-fetch";

interface EditorRulesData {
  rules: { rule_id: string; has_draft?: boolean }[];
}

const navItems = [
  { href: "/", labelKey: 'nav.dashboard' as const, Icon: Home },
  { href: "/rules", labelKey: 'nav.rules' as const, Icon: ListChecks },
  { href: "/editor", labelKey: 'nav.editor' as const, Icon: PenLine },
  { href: "/history", labelKey: 'nav.history' as const, Icon: Clock },
  { href: "/analytics", labelKey: 'nav.analytics' as const, Icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: editorData } = useFetch<EditorRulesData>('/api/editor/rules');
  const draftCount = (editorData?.rules ?? []).filter((r) => r.has_draft).length;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border">
        <div className="px-2 py-2">
          <h1 className="text-lg font-bold text-foreground tracking-wide">{t('app.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('app.subtitle')}</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
                    render={<Link href={item.href} />}
                  >
                    <item.Icon className="w-4 h-4" />
                    <span>{t(item.labelKey)}</span>
                    {item.href === '/editor' && draftCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-auto px-1.5 py-0">{draftCount}</Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground">{t('app.version')}</div>
      </SidebarFooter>
    </Sidebar>
  );
}
