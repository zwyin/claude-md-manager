# UI 全面重写实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 CLAUDE.md Manager 仪表盘进行全面 UI 重写：统一中文界面、添加术语解释、升级可视化图表、现代化视觉风格。

**Architecture:** 自建 i18n（React Context + 字典文件），recharts 替换 div 条形图，shadcn Tooltip 实现术语解释。所有页面重写为中文优先。

**Tech Stack:** Next.js 16, React 19, shadcn/ui, recharts 3, @dnd-kit, @uiw/react-codemirror, better-sqlite3

---

## File Structure

```
web/src/
├── i18n/
│   ├── index.tsx            # I18nProvider + useI18n hook（新建）
│   ├── zh.ts                # 中文字典（新建）
│   └── en.ts                # 英文字典（新建）
├── components/
│   ├── app-sidebar.tsx      # 重写：中文导航标签
│   ├── top-bar.tsx          # 新增：右上角语言切换器
│   ├── stat-card.tsx        # 新增：统计卡片（含 sparkline）
│   ├── term-tooltip.tsx     # 新增：术语解释 tooltip
│   └── ui/                  # shadcn 现有组件不动
├── app/
│   ├── layout.tsx           # 修改：添加 I18nProvider + TopBar
│   ├── page.tsx             # 重写：Dashboard
│   ├── rules/
│   │   ├── page.tsx         # 重写：规则管理
│   │   └── [id]/page.tsx    # 重写：规则详情
│   ├── editor/              # 视觉微调（标签中文化）
│   ├── history/page.tsx     # 重写：版本历史
│   ├── analytics/
│   │   └── page.tsx         # 重写：数据分析
│   └── api/
│       ├── analytics/
│       │   └── route.ts     # 修改：增加 citation_trend 字段
│       └── (其余 API 不变)
```

---

### Task 1: i18n 基础设施

**Files:**
- Create: `web/src/i18n/zh.ts`
- Create: `web/src/i18n/en.ts`
- Create: `web/src/i18n/index.tsx`

- [ ] **Step 1: 创建中文字典 `zh.ts`**

```typescript
// web/src/i18n/zh.ts

const zh = {
  // 全局
  'app.title': 'CLAUDE.md',
  'app.subtitle': '规则管理面板',
  'app.version': 'v0.1.0',

  // 导航
  'nav.dashboard': '仪表盘',
  'nav.rules': '规则管理',
  'nav.editor': '编辑器',
  'nav.history': '版本历史',
  'nav.analytics': '数据分析',

  // 语言
  'lang.zh': '中文',
  'lang.en': 'English',

  // Dashboard
  'dashboard.title': '仪表盘',
  'dashboard.subtitle': 'CLAUDE.md 规则概览与统计数据',
  'dashboard.totalRules': '总规则数',
  'dashboard.totalSessions': '总会话数',
  'dashboard.activeRate': '规则活跃率',
  'dashboard.totalCitations': '引用总量',
  'dashboard.inSections': '{count} 个章节',
  'dashboard.sections': '章节概览',
  'dashboard.sections.subtitle': '按引用次数排序的章节',
  'dashboard.topRules': '热门规则 Top 10',
  'dashboard.coldRules': '休眠规则',
  'dashboard.coldRules.count': '{count} 条规则',
  'dashboard.coldRules.subtitle': '从未被引用过的规则',

  // 表格通用
  'table.section': '章节',
  'table.rules': '子规则',
  'table.citations': '引用次数',
  'table.sessions': '会话数',
  'table.rank': '排名',
  'table.title': '标题',
  'table.time': '时间',
  'table.keyword': '触发关键词',
  'table.sessionId': '会话 ID',
  'table.date': '日期',
  'table.sourceFile': '来源文件',
  'table.matches': '匹配数',

  // Rules 列表
  'rules.title': '规则管理',
  'rules.subtitle': '{total} 条规则，分布在 {sections} 个章节',
  'rules.totalMatches': '共 {count} 次匹配',

  // Rules 详情
  'ruleDetail.backTo': '返回 {section}',
  'ruleDetail.section': '所属章节',
  'ruleDetail.source': '来源文件',
  'ruleDetail.lastCited': '最后引用',
  'ruleDetail.keywords': '关键词',
  'ruleDetail.sameSection': '同章节规则',
  'ruleDetail.citations': '引用记录',
  'ruleDetail.citations.subtitle': '最近 {count} 条引用',
  'ruleDetail.noCitations': '暂无引用数据',
  'ruleDetail.showing': '显示 {shown} / {total} 条',

  // Editor
  'editor.title': '规则编辑器',
  'editor.subtitle': '拖拽排序、编辑、预览和发布规则变更',
  'editor.yamlFrontmatter': 'YAML 前置配置',
  'editor.markdownBody': 'Markdown 正文',
  'editor.saveDraft': '保存草稿',
  'editor.discardDraft': '丢弃草稿',
  'editor.unsavedChanges': '未保存的更改',
  'editor.unsavedDrafts': '{count} 个未保存草稿',
  'editor.publishAll': '全部发布',
  'editor.publishTitle': '发布确认',
  'editor.publishDesc': '以下规则将被发布到文件系统：',
  'editor.publish': '发布',
  'editor.cancel': '取消',
  'editor.published': '成功发布 {count} 条规则。',
  'editor.selectRule': '选择一条规则进行编辑',
  'editor.preview': '预览',
  'editor.rules': '规则列表',
  'editor.draft': '有草稿',

  // History
  'history.title': '版本历史',
  'history.subtitle': '按更新日期和来源文件分组的规则元数据',
  'history.noSnapshots': '暂无历史快照',

  // Analytics
  'analytics.title': '数据分析',
  'analytics.subtitle': '规则使用统计与分布',
  'analytics.topRules': '热门规则 Top 10',
  'analytics.sectionDist': '章节分布',
  'analytics.citationTrend': '引用趋势',
  'analytics.coldRules': '休眠规则',
  'analytics.coldRules.days': '{days} 天未引用',
  'analytics.neverCited': '从未引用',
  'analytics.trend.day': '按天',
  'analytics.trend.week': '按周',
  'analytics.trend.month': '按月',

  // 术语
  'term.rule': '规则',
  'term.rule.desc': 'CLAUDE.md 中的一条独立配置指令',
  'term.section': '章节',
  'term.section.desc': '规则所属的功能分组，如"核心原则"、"安全护栏"',
  'term.citation': '引用记录',
  'term.citation.desc': 'Claude 会话中触发该规则时产生的一条匹配记录',
  'term.session': '会话',
  'term.session.desc': '一次 Claude Code 交互过程',
  'term.match': '匹配',
  'term.match.desc': '规则的关键词被会话内容命中的次数',
  'term.activeRate': '规则活跃率',
  'term.activeRate.desc': '至少被引用过一次的规则占总规则数的百分比',
  'term.coldRule': '休眠规则',
  'term.coldRule.desc': '从未被引用过的规则，可能需要优化或移除',
  'term.draft': '草稿',
  'term.draft.desc': '编辑器中已修改但尚未发布的规则内容',
  'term.snapshot': '快照',
  'term.snapshot.desc': '规则文件在某个时间点的版本备份',
  'term.keywords': '关键词',
  'term.keywords.desc': '规则配置的触发词，Claude 会话中出现时自动引用该规则',

  // 状态
  'status.loading': '加载中...',
  'status.error': '加载失败：{error}',
} as const;

export default zh;
export type Dict = typeof zh;
```

- [ ] **Step 2: 创建英文字典 `en.ts`**

```typescript
// web/src/i18n/en.ts

import type { Dict } from './zh';

const en: Dict = {
  'app.title': 'CLAUDE.md',
  'app.subtitle': 'Rule Management Dashboard',
  'app.version': 'v0.1.0',
  'nav.dashboard': 'Dashboard',
  'nav.rules': 'Rules',
  'nav.editor': 'Editor',
  'nav.history': 'History',
  'nav.analytics': 'Analytics',
  'lang.zh': '中文',
  'lang.en': 'English',
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'CLAUDE.md rule overview and statistics',
  'dashboard.totalRules': 'Total Rules',
  'dashboard.totalSessions': 'Total Sessions',
  'dashboard.activeRate': 'Active Rate',
  'dashboard.totalCitations': 'Total Citations',
  'dashboard.inSections': '{count} sections',
  'dashboard.sections': 'Sections Overview',
  'dashboard.sections.subtitle': 'Sections sorted by citation count',
  'dashboard.topRules': 'Top 10 Rules',
  'dashboard.coldRules': 'Cold Rules',
  'dashboard.coldRules.count': '{count} rules',
  'dashboard.coldRules.subtitle': 'Rules with zero citations',
  'table.section': 'Section',
  'table.rules': 'Rules',
  'table.citations': 'Citations',
  'table.sessions': 'Sessions',
  'table.rank': 'Rank',
  'table.title': 'Title',
  'table.time': 'Time',
  'table.keyword': 'Keyword',
  'table.sessionId': 'Session ID',
  'table.date': 'Date',
  'table.sourceFile': 'Source File',
  'table.matches': 'Matches',
  'rules.title': 'Rules',
  'rules.subtitle': '{total} rules in {sections} sections',
  'rules.totalMatches': '{count} total matches',
  'ruleDetail.backTo': 'Back to {section}',
  'ruleDetail.section': 'Section',
  'ruleDetail.source': 'Source',
  'ruleDetail.lastCited': 'Last cited',
  'ruleDetail.keywords': 'Keywords',
  'ruleDetail.sameSection': 'Same Section',
  'ruleDetail.citations': 'Citations',
  'ruleDetail.citations.subtitle': 'Last {count} citations',
  'ruleDetail.noCitations': 'No citation data available',
  'ruleDetail.showing': 'Showing {shown} / {total}',
  'editor.title': 'Rule Editor',
  'editor.subtitle': 'Drag to reorder, edit, preview, and publish rule changes.',
  'editor.yamlFrontmatter': 'YAML Frontmatter',
  'editor.markdownBody': 'Markdown Body',
  'editor.saveDraft': 'Save Draft',
  'editor.discardDraft': 'Discard Draft',
  'editor.unsavedChanges': 'Unsaved changes',
  'editor.unsavedDrafts': '{count} unsaved drafts',
  'editor.publishAll': 'Publish All',
  'editor.publishTitle': 'Publish Confirmation',
  'editor.publishDesc': 'The following rules will be published:',
  'editor.publish': 'Publish',
  'editor.cancel': 'Cancel',
  'editor.published': 'Published {count} rules successfully.',
  'editor.selectRule': 'Select a rule to edit',
  'editor.preview': 'Preview',
  'editor.rules': 'Rules',
  'editor.draft': 'Draft',
  'history.title': 'Version History',
  'history.subtitle': 'Rule metadata grouped by update date and source file',
  'history.noSnapshots': 'No history snapshots available',
  'analytics.title': 'Analytics',
  'analytics.subtitle': 'Rule usage statistics and distribution',
  'analytics.topRules': 'Top 10 Rules',
  'analytics.sectionDist': 'Section Distribution',
  'analytics.citationTrend': 'Citation Trend',
  'analytics.coldRules': 'Cold Rules',
  'analytics.coldRules.days': '{days} days since last citation',
  'analytics.neverCited': 'Never cited',
  'analytics.trend.day': 'Daily',
  'analytics.trend.week': 'Weekly',
  'analytics.trend.month': 'Monthly',
  'term.rule': 'Rule',
  'term.rule.desc': 'An independent configuration directive in CLAUDE.md',
  'term.section': 'Section',
  'term.section.desc': 'A functional grouping for rules, e.g. "Core Principles", "Safety Guardrails"',
  'term.citation': 'Citation',
  'term.citation.desc': 'A match record generated when a rule is triggered in a Claude session',
  'term.session': 'Session',
  'term.session.desc': 'One Claude Code interaction process',
  'term.match': 'Match',
  'term.match.desc': 'Number of times a rule\'s keywords were matched in session content',
  'term.activeRate': 'Active Rate',
  'term.activeRate.desc': 'Percentage of rules cited at least once out of total rules',
  'term.coldRule': 'Cold Rule',
  'term.coldRule.desc': 'Rules never cited — candidates for optimization or removal',
  'term.draft': 'Draft',
  'term.draft.desc': 'Modified but unpublished rule content in the editor',
  'term.snapshot': 'Snapshot',
  'term.snapshot.desc': 'A version backup of rule files at a specific point in time',
  'term.keywords': 'Keywords',
  'term.keywords.desc': 'Trigger words configured for a rule, auto-cited when appearing in Claude sessions',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load: {error}',
};

export default en;
```

- [ ] **Step 3: 创建 I18nProvider + useI18n hook `index.tsx`**

```typescript
// web/src/i18n/index.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import zh from './zh';
import en from './en';
import type { Dict } from './zh';

const dicts: Record<string, Dict> = { zh, en };

type InterpolateArgs = Record<string, string | number>;

interface I18nContextValue {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: keyof Dict, args?: InterpolateArgs) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>('zh');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved && dicts[saved]) {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: string) => {
    if (dicts[newLang]) {
      setLangState(newLang);
      localStorage.setItem('lang', newLang);
    }
  }, []);

  const t = useCallback(
    (key: keyof Dict, args?: InterpolateArgs): string => {
      let text = dicts[lang]?.[key] || dicts.zh[key] || key;
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/i18n/
git commit -m "feat(i18n): add i18n infrastructure with zh/en dictionaries"
```

---

### Task 2: TermTooltip 组件 + StatCard 组件 + TopBar 组件

**Files:**
- Create: `web/src/components/term-tooltip.tsx`
- Create: `web/src/components/stat-card.tsx`
- Create: `web/src/components/top-bar.tsx`

- [ ] **Step 1: 创建 TermTooltip 组件**

```typescript
// web/src/components/term-tooltip.tsx
'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TermTooltipProps {
  term: string;
  explanation: string;
}

export function TermTooltip({ term, explanation }: TermTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 cursor-help border-b border-dashed border-muted-foreground/50">
          {term}
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-sm">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: 创建 StatCard 组件**

```typescript
// web/src/components/stat-card.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: Array<{ date: string; count: number }>;
  color?: string;
  percentage?: boolean;
}

export function StatCard({ label, value, sublabel, trend, color = '#6366f1', percentage }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = typeof value === 'string' ? parseInt(value, 10) || 0 : value;
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (Number.isNaN(targetValue)) {
      setDisplayValue(0);
      return;
    }
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(targetValue * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue]);

  const formattedValue = percentage
    ? `${displayValue}%`
    : displayValue.toLocaleString();

  return (
    <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 overflow-hidden">
      <CardContent className="p-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="text-3xl font-bold" style={percentage ? { color } : undefined}>
          {formattedValue}
        </div>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
        )}
        {trend && trend.length > 1 && (
          <div className="mt-3 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={color}
                  fill={`url(#gradient-${label})`}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 创建 TopBar 组件**

```typescript
// web/src/components/top-bar.tsx
'use client';

import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex items-center justify-end px-6 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        className="flex items-center gap-1.5 text-xs"
      >
        <Globe className="w-3.5 h-3.5" />
        {lang === 'zh' ? t('lang.en') : t('lang.zh')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/components/term-tooltip.tsx web/src/components/stat-card.tsx web/src/components/top-bar.tsx
git commit -m "feat(ui): add TermTooltip, StatCard with sparkline, and TopBar components"
```

---

### Task 3: 集成 I18nProvider + TopBar 到 Layout + 重写 Sidebar

**Files:**
- Modify: `web/src/app/layout.tsx`
- Rewrite: `web/src/components/app-sidebar.tsx`

- [ ] **Step 1: 修改 layout.tsx**

将 `I18nProvider` 包裹在 `TooltipProvider` 外层，在 `SidebarInset` 内添加 `TopBar`。

修改后的完整 `layout.tsx`：

```typescript
// web/src/app/layout.tsx
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
```

- [ ] **Step 2: 重写 app-sidebar.tsx**

导航标签改为 i18n 翻译，保持 shadcn Sidebar 组件结构。注意：Sidebar 是 server component 友好的，但 useI18n 需要 client，所以需要 `'use client'`。

```typescript
// web/src/components/app-sidebar.tsx
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
import { useI18n } from "@/i18n";

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

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-white/10">
        <div className="px-2 py-2">
          <h1 className="text-lg font-bold text-white tracking-wide">{t('app.title')}</h1>
          <p className="text-xs text-[#a0aec0]">{t('app.subtitle')}</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    render={<Link href={item.href} />}
                  >
                    <item.Icon className="w-4 h-4" />
                    <span>{t(item.labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-[#718096]">{t('app.version')}</div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 3: 安装 lucide-react（如未安装）并 Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/web
npm ls lucide-react 2>/dev/null | head -3
# 如果没有则: npm install lucide-react

cd ..
git add web/src/app/layout.tsx web/src/components/app-sidebar.tsx
git commit -m "feat(layout): integrate I18nProvider, TopBar, and rewrite sidebar with i18n"
```

---

### Task 4: 扩展 Analytics API — 增加 citation_trend

**Files:**
- Modify: `web/src/app/api/analytics/route.ts`

- [ ] **Step 1: 读取当前 analytics route**

读取 `web/src/app/api/analytics/route.ts`，了解当前结构。

- [ ] **Step 2: 在 route.ts 的 GET handler 中增加 citation_trend**

在调用 `getAnalytics()` 后，额外调用 `getCitations({ days: 30, group_by: 'day' })` 获取趋势数据，合并到响应中。

在 route.ts 的响应 JSON 中增加 `citation_trend` 字段：

```typescript
// 在 route.ts GET handler 中增加：
import { getCitations } from '@/lib/db';

// 在 return Response.json(...) 前：
const citation_trend = getCitations({ days: 30, group_by: 'day' });

// 响应中合并：
return Response.json({ ...data, citation_trend });
```

- [ ] **Step 3: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/api/analytics/route.ts
git commit -m "feat(api): add citation_trend to analytics endpoint"
```

---

### Task 5: 重写 Dashboard 页面

**Files:**
- Rewrite: `web/src/app/page.tsx`

- [ ] **Step 1: 完整重写 Dashboard**

新 Dashboard 包含：4 列 StatCard、recharts 章节条形图、Top 10 规则条形图、休眠规则折叠面板。

```typescript
// web/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { StatCard } from '@/components/stat-card';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';

interface Rule {
  rule_id: string; section_id: string; section_title: string;
  title: string; keywords: string[]; session_count: number; match_count: number;
}
interface Section {
  section_id: string; title: string; source_file: string;
  rule_count: number; total_citations: number; total_sessions: number;
}
interface DashboardData {
  rules: Rule[]; sections: Section[];
  total_rules: number; total_sessions: number; active_rule_pct: number;
}

const CHART_COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed'];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coldOpen, setColdOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = (data.rules || []).filter((r) => r.match_count === 0);
  const sections = data.sections || [];

  const sectionChartData = sections.map((s) => ({
    name: s.title,
    citations: s.total_citations,
    section_id: s.section_id,
  }));

  const topRulesChartData = topRules.map((r) => ({
    name: r.title.length > 20 ? r.title.slice(0, 20) + '...' : r.title,
    fullName: r.title,
    citations: r.match_count,
    rule_id: r.rule_id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.totalRules')}
          value={data.total_rules}
          sublabel={t('dashboard.inSections', { count: sections.length })}
          color="#6366f1"
        />
        <StatCard
          label={t('dashboard.totalSessions')}
          value={data.total_sessions}
          color="#3b82f6"
        />
        <StatCard
          label={<TermTooltip term={t('term.activeRate')} explanation={t('term.activeRate.desc')} />}
          value={data.active_rule_pct}
          percentage
          color="#10b981"
        />
        <StatCard
          label={<TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />}
          value={(data.rules || []).reduce((s, r) => s + r.match_count, 0)}
          color="#8b5cf6"
        />
      </div>

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.sections')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('dashboard.sections.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {sectionChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.topRules')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRulesChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  formatter={(value: number, name: string, props: { payload: { fullName: string } }) => [value, props.payload.fullName]}
                />
                <Bar dataKey="citations" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {coldRules.length > 0 && (
        <Collapsible open={coldOpen} onOpenChange={setColdOpen}>
          <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${coldOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-base font-semibold">
                  <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
                </span>
              </div>
              <Badge variant="outline" className="text-amber-500">{t('dashboard.coldRules.count', { count: coldRules.length })}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-slate-800 divide-y divide-slate-800">
                {coldRules.map((rule) => (
                  <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground">{rule.rule_id}</span>
                      <span className="text-sm">{rule.title}</span>
                    </div>
                    <Badge variant="destructive" className="text-xs">0 {t('table.matches')}</Badge>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
```

注意：`StatCard` 的 `label` prop 类型需调整为 `ReactNode`。回到 `stat-card.tsx` 修改：

```typescript
// web/src/components/stat-card.tsx
// label prop 类型改为 ReactNode:
interface StatCardProps {
  label: React.ReactNode;  // 改为 ReactNode
  value: string | number;
  sublabel?: string;
  trend?: Array<{ date: string; count: number }>;
  color?: string;
  percentage?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/page.tsx web/src/components/stat-card.tsx
git commit -m "feat(dashboard): rewrite with recharts, StatCards, TermTooltips, and i18n"
```

---

### Task 6: 重写 Rules 列表页面

**Files:**
- Rewrite: `web/src/app/rules/page.tsx`

- [ ] **Step 1: 重写 Rules 列表页**

章节折叠卡片带彩色竖条，规则行带 sparkline。

```typescript
// web/src/app/rules/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n';

interface Rule {
  rule_id: string; section_id: string; section_title: string;
  title: string; keywords: string[]; session_count: number; match_count: number;
}
interface Section {
  section_id: string; title: string; source_file: string;
  rule_count: number; total_citations: number; total_sessions: number;
}
interface RulesData {
  rules: Rule[]; sections: Section[]; total_rules: number;
}

const SECTION_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function MiniSparkline({ session, matches }: { session: number; matches: number }) {
  const data = [
    { v: session },
    { v: matches },
  ];
  const max = Math.max(session, matches, 1);
  const chartData = [
    { i: 0, v: session / max },
    { i: 1, v: matches / max },
  ];
  return (
    <div className="w-12 h-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area type="monotone" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4">Loading...</div>}>
      <RulesContent />
    </Suspense>
  );
}

function RulesContent() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setData(json);
        const open: Record<string, boolean> = {};
        const focusSection = searchParams.get('section');
        (json.rules || []).forEach((r: Rule) => {
          open[r.section_id] = focusSection ? r.section_id === focusSection : true;
        });
        setOpenSections(open);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [searchParams]);

  const toggle = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const sectionTitleMap: Record<string, string> = {};
  for (const sec of data.sections || []) {
    sectionTitleMap[sec.section_id] = sec.title;
  }

  const grouped: Record<string, Rule[]> = {};
  for (const rule of data.rules || []) {
    if (!grouped[rule.section_id]) grouped[rule.section_id] = [];
    grouped[rule.section_id].push(rule);
  }

  const sectionOrder = (data.sections || [])
    .sort((a, b) => b.total_citations - a.total_citations)
    .map((s) => s.section_id);
  for (const id of Object.keys(grouped)) {
    if (!sectionOrder.includes(id)) sectionOrder.push(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('rules.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('rules.subtitle', { total: data.total_rules, sections: Object.keys(grouped).length })}
        </p>
      </div>

      <div className="space-y-3">
        {sectionOrder.map((sectionId, sIdx) => {
          const rules = grouped[sectionId];
          if (!rules) return null;
          const isOpen = openSections[sectionId] !== false;
          const totalMatches = rules.reduce((s, r) => s + r.match_count, 0);
          const sectionTitle = sectionTitleMap[sectionId] || sectionId;
          const color = SECTION_COLORS[sIdx % SECTION_COLORS.length];

          return (
            <Card key={sectionId} className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={() => toggle(sectionId)}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color }} />
                    <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold">{sectionTitle}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sectionId}</span>
                    <span className="text-xs text-muted-foreground">{rules.length} {t('table.rules')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{t('rules.totalMatches', { count: totalMatches })}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-slate-800">
                    {rules.map((rule) => (
                      <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                        className="flex items-center justify-between px-5 py-3 pl-14 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                          <span className="text-sm truncate">{rule.title}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <MiniSparkline session={rule.session_count} matches={rule.match_count} />
                          <Badge variant="secondary" className="text-xs">{rule.session_count} {t('table.sessions')}</Badge>
                          <Badge variant={rule.match_count === 0 ? "destructive" : "default"} className="text-xs">{rule.match_count}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/rules/page.tsx
git commit -m "feat(rules): rewrite rules list with colored section bars, sparklines, and i18n"
```

---

### Task 7: 重写 Rule Detail 页面

**Files:**
- Rewrite: `web/src/app/rules/[id]/page.tsx`

- [ ] **Step 1: 重写规则详情页**

面包屑导航、信息卡、同章节规则横向滚动、引用记录表格。

```typescript
// web/src/app/rules/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';

interface Rule {
  rule_id: string; section_id: string; title: string; keywords: string[];
  source_file: string; updated_at: string; citation_count: number; last_cited: string | null;
}
interface CitationRecord {
  id: number; rule_id: string; session_id: string; matched_keyword: string;
  timestamp: string; model: string | null; task_summary: string | null;
}
interface SiblingRule {
  rule_id: string; title: string; session_count: number; match_count: number;
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const [rule, setRule] = useState<Rule | null>(null);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [siblings, setSiblings] = useState<SiblingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!ruleId) return;
    fetch(`/api/rules/${encodeURIComponent(ruleId)}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setRule(json.rule);
        setCitations(json.citations || []);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [ruleId]);

  useEffect(() => {
    if (!rule?.section_id) return;
    fetch('/api/rules')
      .then((res) => res.json())
      .then((json) => {
        const allRules = json.rules || [];
        const sibs = allRules
          .filter((r: { section_id: string; rule_id: string }) => r.section_id === rule.section_id && r.rule_id !== rule.rule_id)
          .map((r: { rule_id: string; title: string; session_count: number; match_count: number }) => ({
            rule_id: r.rule_id, title: r.title,
            session_count: r.session_count || 0, match_count: r.match_count || 0,
          }));
        setSiblings(sibs);
      })
      .catch(() => {});
  }, [rule?.section_id, rule?.rule_id]);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return (
    <div className="space-y-4">
      <Link href="/rules" className="text-sm text-indigo-400 hover:underline">&larr; {t('ruleDetail.backTo', { section: 'Rules' })}</Link>
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>
    </div>
  );
  if (!rule) return null;

  const uniqueSessions = new Set(citations.map((c) => c.session_id)).size;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/rules" className="hover:text-foreground transition-colors">{t('rules.title')}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/rules?section=${rule.section_id}`} className="hover:text-foreground transition-colors">{rule.section_id}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{rule.title}</span>
      </nav>

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-1">{rule.rule_id}</p>
              <CardTitle className="text-xl">{rule.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-2 space-x-2">
                <span>{t('ruleDetail.section')}:
                  <Link href={`/rules?section=${rule.section_id}`} className="font-medium text-indigo-400 hover:underline ml-1">{rule.section_id}</Link>
                </span>
                <span>·</span>
                <span>{t('ruleDetail.source')}:
                  <span className="font-medium text-foreground ml-1">{rule.source_file}</span>
                </span>
              </p>
              {rule.last_cited && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('ruleDetail.lastCited')}: {new Date(rule.last_cited).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">{uniqueSessions} {t('table.sessions')}</Badge>
              <Badge variant={rule.citation_count === 0 ? "destructive" : "default"}>{rule.citation_count} {t('table.matches')}</Badge>
            </div>
          </div>
        </CardHeader>
        {rule.keywords && rule.keywords.length > 0 && (
          <CardContent>
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                <TermTooltip term={t('term.keywords')} explanation={t('term.keywords.desc')} />
              </p>
              <div className="flex flex-wrap gap-2">
                {rule.keywords.map((kw) => (
                  <Badge key={kw} variant="outline" className="border-indigo-500/30 text-indigo-300">{kw}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {siblings.length > 0 && (
        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.sameSection')} ({rule.section_id})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {siblings.map((sib) => (
                <Link key={sib.rule_id} href={`/rules/${sib.rule_id}`}
                  className="shrink-0 w-48 p-3 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{sib.rule_id}</p>
                  <p className="text-sm font-medium truncate">{sib.title}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{sib.match_count}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />
            <span className="text-muted-foreground font-normal">({citations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {citations.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.time')}</TableHead>
                    <TableHead>{t('table.keyword')}</TableHead>
                    <TableHead>{t('table.sessionId')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citations.slice(0, 50).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {new Date(c.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="border-indigo-500/30 text-indigo-300">{c.matched_keyword}</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                        {c.session_id.replace('historical_', '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {citations.length > 50 && (
                <div className="px-6 py-3 text-xs text-muted-foreground text-center border-t border-slate-800">
                  {t('ruleDetail.showing', { shown: 50, total: citations.length })}
                </div>
              )}
            </>
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">{t('ruleDetail.noCitations')}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/rules/[id]/page.tsx
git commit -m "feat(rule-detail): rewrite with breadcrumbs, sibling cards, citation table, and i18n"
```

---

### Task 8: 重写 Analytics 页面

**Files:**
- Rewrite: `web/src/app/analytics/page.tsx`

- [ ] **Step 1: 重写数据分析页面**

recharts BarChart + PieChart + AreaChart，按天/周/月切换。

```typescript
// web/src/app/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area,
} from 'recharts';
import { StatCard } from '@/components/stat-card';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';

interface TopRule { rule_id: string; title: string; citation_count: number; }
interface ColdRule { rule_id: string; title: string; days_since_last_citation: number | null; }
interface CategoryDist { section_id: string; rule_count: number; citation_count: number; }
interface TrendPoint { period: string; count: number; }

interface AnalyticsData {
  total_rules: number; total_citations: number; total_sessions: number;
  top_rules: TopRule[]; cold_rules: ColdRule[];
  category_distribution: CategoryDist[];
  citation_trend: TrendPoint[];
}

const CHART_COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed', '#4f46e5'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day');
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const topRulesData = (data.top_rules || []).map((r) => ({
    name: r.title.length > 18 ? r.title.slice(0, 18) + '...' : r.title,
    fullName: r.title,
    citations: r.citation_count,
    rule_id: r.rule_id,
  }));

  const pieData = (data.category_distribution || []).map((c) => ({
    name: c.section_id,
    value: c.citation_count,
    ruleCount: c.rule_count,
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('dashboard.totalRules')} value={data.total_rules} color="#6366f1" />
        <StatCard label={<TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />} value={data.total_citations} color="#10b981" />
        <StatCard label={t('dashboard.totalSessions')} value={data.total_sessions} color="#3b82f6" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader><CardTitle className="text-base">{t('analytics.topRules')}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRulesData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip {...tooltipStyle} formatter={(value: number, _: string, props: { payload: { fullName: string } }) => [value, props.payload.fullName]} />
                  <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {topRulesData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader><CardTitle className="text-base">{t('analytics.sectionDist')}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip {...tooltipStyle} formatter={(value: number, _: string, props: { payload: { name: string; ruleCount: number } }) => [`${value} citations (${props.payload.ruleCount} rules)`, props.payload.name]} />
                  <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.citation_trend && data.citation_trend.length > 0 && (
        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('analytics.citationTrend')}</CardTitle>
              <div className="flex gap-1">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={trendMode === mode ? 'default' : 'ghost'}
                    onClick={() => setTrendMode(mode)}
                    className="text-xs h-7 px-2"
                  >
                    {t(`analytics.trend.${mode}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.citation_trend} margin={{ left: 0, right: 20 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#trendGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {data.cold_rules && data.cold_rules.length > 0 && (
        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
              </CardTitle>
              <Badge variant="outline" className="text-amber-500">{data.cold_rules.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {data.cold_rules.map((rule) => (
                <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                    <span className="text-sm truncate">{rule.title}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">
                    {rule.days_since_last_citation !== null
                      ? t('analytics.coldRules.days', { days: rule.days_since_last_citation })
                      : t('analytics.neverCited')}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

注意：trendMode 切换需要实时获取新数据。在 useEffect 中根据 trendMode 调用不同 API 参数。实际上 API 端点 `/api/analytics` 已经固定返回 `citation_trend`（按天）。如果要做按周/月切换，需要在 Analytics API 支持 query parameter 或前端过滤。

最简方案：Analytics API 增加 `trend_group` query parameter，调用已有的 `getCitations({ group_by: trendMode })`。

修改 `web/src/app/api/analytics/route.ts`，读取 `request.nextUrl.searchParams.get('trend_group')`，传给 `getCitations`。

在 Analytics 页面的 useEffect 中，trendMode 变化时重新 fetch：

```typescript
useEffect(() => {
  setLoading(true);
  fetch(`/api/analytics?trend_group=${trendMode}`)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then((json) => { setData(json); setLoading(false); })
    .catch((err) => { setError(err.message); setLoading(false); });
}, [trendMode]);
```

- [ ] **Step 2: 修改 analytics API route 支持 trend_group 参数**

在 `web/src/app/api/analytics/route.ts` 的 GET 函数中：

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trendGroup = (searchParams.get('trend_group') || 'day') as 'day' | 'week' | 'month';
  const data = getAnalytics();
  const citation_trend = getCitations({ days: 30, group_by: trendGroup });
  return Response.json({ ...data, citation_trend });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/analytics/page.tsx web/src/app/api/analytics/route.ts
git commit -m "feat(analytics): rewrite with recharts Bar/Pie/Area charts, trend switching, and i18n"
```

---

### Task 9: 重写 History 页面

**Files:**
- Rewrite: `web/src/app/history/page.tsx`

- [ ] **Step 1: 重写版本历史为时间线视图**

```typescript
// web/src/app/history/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { useI18n } from '@/i18n';

interface SnapshotEntry {
  snapshot_ts: string;
  rule_count: number;
  source_file: string;
}

export default function HistoryPage() {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/history')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setSnapshots(json.snapshots || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('history.subtitle')}</p>
      </div>

      {snapshots.length > 0 ? (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-800" />
          <div className="space-y-4">
            {snapshots.map((s, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-5 top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-950" />
                <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 ml-4">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{s.snapshot_ts}</span>
                      <Badge variant="outline" className="text-xs font-mono text-muted-foreground">{s.source_file}</Badge>
                    </div>
                    <Badge variant="secondary">{s.rule_count} {t('table.rules')}</Badge>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('history.noSnapshots')}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/history/page.tsx
git commit -m "feat(history): rewrite with timeline view, empty state, and i18n"
```

---

### Task 10: Editor 页面中文化

**Files:**
- Modify: `web/src/app/editor/page.tsx`
- Modify: `web/src/app/editor/EditorPanel.tsx`
- Modify: `web/src/app/editor/RuleListPanel.tsx`
- Modify: `web/src/app/editor/PreviewPanel.tsx`
- Modify: `web/src/app/editor/PublishDialog.tsx`

- [ ] **Step 1: 修改 editor/page.tsx 使用 i18n**

在 `page.tsx` 中替换所有硬编码英文文案：

- `'Rule Editor'` → `t('editor.title')`
- `'Drag to reorder...'` → `t('editor.subtitle')`
- `'unsaved draft(s)'` → `t('editor.unsavedDrafts', { count: draftCount })`
- `'Publish All'` → `t('editor.publishAll')`
- `'Select a rule to edit'` → `t('editor.selectRule')`
- `'Preview'` → `t('editor.preview')`

添加 `'use client'` 导入 `useI18n`，组件内 `const { t } = useI18n()`。

- [ ] **Step 2: 修改 EditorPanel.tsx 使用 i18n**

替换：
- `'Save Draft'` → `t('editor.saveDraft')`
- `'Discard Draft'` → `t('editor.discardDraft')`
- `'Unsaved changes'` → `t('editor.unsavedChanges')`
- `'YAML Frontmatter'` → `t('editor.yamlFrontmatter')`
- `'Markdown Body'` → `t('editor.markdownBody')`

添加 `import { useI18n } from '@/i18n'` 和 `const { t } = useI18n()`。

- [ ] **Step 3: 修改 RuleListPanel.tsx 使用 i18n**

替换：
- `'Rules ({rules.length})'` → `{t('editor.rules')} ({rules.length})`
- `'Has draft'` title → `t('editor.draft')`

添加 `import { useI18n } from '@/i18n'`。

- [ ] **Step 4: 修改 PreviewPanel.tsx 使用 i18n**

替换 `'Preview'` → `t('editor.preview')`。

- [ ] **Step 5: 修改 PublishDialog.tsx 使用 i18n**

替换：
- `'Publish Confirmation'` → `t('editor.publishTitle')`
- `'The following rules will be published:'` → `t('editor.publishDesc')`
- `'Publish'` → `t('editor.publish')`
- `'Cancel'` → `t('editor.cancel')`

- [ ] **Step 6: Commit**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add web/src/app/editor/
git commit -m "feat(editor): internationalize all editor labels to use i18n"
```

---

### Task 11: 构建验证 + 修复

**Files:**
- Potentially fix any build errors in above tasks

- [ ] **Step 1: 运行 Next.js 构建**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/web && npx next build 2>&1 | tail -40
```

Expected: Build succeeds, all pages compile.

- [ ] **Step 2: 修复任何构建错误**

如果出现类型错误、import 错误等，逐一修复。

- [ ] **Step 3: Commit 修复**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager
git add -A
git commit -m "fix: resolve build errors from UI redesign"
```

---

### Task 12: 部署到生产环境 + 浏览器验证

- [ ] **Step 1: 构建生产版本**

```bash
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/web && npx next build
```

- [ ] **Step 2: 重启生产服务器**

```bash
lsof -ti:3456 | xargs kill 2>/dev/null
sleep 1
cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/web && nohup npx next start -H 0.0.0.0 -p 3456 > /tmp/claude-md-manager.log 2>&1 &
```

- [ ] **Step 3: 浏览器验证所有页面**

使用 Chrome DevTools 逐页验证：
1. `/` — Dashboard：StatCard 数字动画、recharts 图表渲染、休眠规则折叠
2. `/rules` — 规则列表：彩色竖条、sparkline、折叠展开
3. `/rules/[id]` — 规则详情：面包屑、同章节横向滚动、引用记录表格
4. `/editor` — 编辑器：中文标签、三栏布局正常
5. `/history` — 版本历史：时间线视图、空状态
6. `/analytics` — 数据分析：条形图、饼图、趋势图、按天/周/月切换
7. 右上角语言切换器：点击切换中英文，刷新后保持

- [ ] **Step 4: 修复发现的视觉问题**

如果有问题，修复并重新构建部署。

---

### Task 13: E2E 验证 + Code Review（独立 Agent）

- [ ] **Step 1: 派遣独立 E2E 测试 Agent**

使用 browser agent 对所有 6 个页面做端到端验证，检查：
- 页面加载无报错
- recharts 图表正确渲染
- 语言切换功能正常
- 导航跳转正确
- 响应式布局不崩溃

- [ ] **Step 2: 派遣独立 Code Review Agent**

对本次所有改动做 code review，重点：
- TypeScript 类型一致性
- i18n key 齐全性（zh.ts 和 en.ts 覆盖一致）
- recharts 使用正确性
- 组件职责清晰度
- 死代码 / 未使用 import

- [ ] **Step 3: 根据两个 Agent 的反馈修复问题并最终部署**
