# UI 全面重写设计规格

Date: 2026-05-17

## 概述

对 CLAUDE.md Manager 仪表盘进行全面 UI 重写：统一中文界面、添加术语解释、升级可视化图表、现代化视觉风格。

## 决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 重写范围 | 全部页面 | 用户选择方案 B，统一设计语言 |
| i18n 方案 | 自建 Context + 字典文件 | 页面数量有限，不需要 next-intl 等重库 |
| 图表库 | recharts（已安装） | 项目已有依赖，功能满足需求 |
| 视觉升级 | 深色主题 slate + indigo | 现代感强，与开发者工具风格一致 |
| 术语方案 | Tooltip 包裹 + 帮助图标 | 不打断阅读流，需要时才展示 |

## 全局架构

```
layout.tsx
├── I18nProvider (React Context, zh/en 字典 + localStorage 持久化)
├── SidebarProvider
│   ├── AppSidebar (重新设计导航，中文标签 + 图标)
│   └── SidebarInset
│       ├── TopBar (右上角：语言切换器 Globe 图标下拉)
│       └── main
│           └── 各页面
```

### i18n 实现

目录结构 `src/i18n/`：

- `index.tsx`：`I18nProvider` 组件 + `useI18n()` hook，提供 `t(key)` 翻译函数
- `zh.ts`：中文字典，所有页面文案集中管理
- `en.ts`：英文字典

语言切换逻辑：

1. 初始值从 `localStorage.getItem('lang')` 读取，默认 `'zh'`
2. 切换时写入 localStorage，组件自动重渲染
3. 字典 key 按页面分组：`dashboard.*`、`rules.*`、`analytics.*` 等

### TopBar 语言切换器

位置：SidebarInset 顶部右侧。组件 `TopBar`：

- Globe 图标按钮
- 点击弹出下拉菜单：中文 / English
- 当前语言显示勾选标记

## 术语体系

所有专业术语统一翻译，首次出现处用 `TermTooltip` 组件包裹：

| 英文 | 中文 | Tooltip 说明 |
|------|------|-------------|
| Rule | 规则 | CLAUDE.md 中的一条独立配置指令 |
| Section | 章节 | 规则所属的功能分组，如"核心原则"、"安全护栏" |
| Citation | 引用记录 | Claude 会话中触发该规则时产生的一条匹配记录 |
| Session | 会话 | 一次 Claude Code 交互过程 |
| Match | 匹配 | 规则的关键词被会话内容命中的次数 |
| Active Rule % | 规则活跃率 | 至少被引用过一次的规则占总规则数的百分比 |
| Cold Rule | 休眠规则 | 从未被引用过的规则，可能需要优化或移除 |
| Draft | 草稿 | 编辑器中已修改但尚未发布的规则内容 |
| Snapshot | 快照 | 规则文件在某个时间点的版本备份 |
| Keywords | 关键词 | 规则配置的触发词，Claude 会话中出现时自动引用该规则 |

`TermTooltip` 组件实现：

```tsx
// src/components/term-tooltip.tsx
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
```

## 页面设计

### Dashboard（仪表盘 `/`）

**统计卡片区（4 列网格）**：

| 卡片 | 内容 | 增强 |
|------|------|------|
| 总规则数 | 数字 + 子标题"N 个章节" | sparkline 迷你趋势（近 7 天引用量） |
| 总会话数 | 数字 | sparkline |
| 规则活跃率 | 百分比，绿色 | 环形进度指示器 |
| 引用总量 | 数字 | sparkline |

**章节概览**：recharts 水平 BarChart，每行一个章节，柱长 = 引用量，渐变色按量级。

**热门规则 Top 10**：recharts 水平 BarChart，带排名数字，点击跳转规则详情。

**休眠规则**：Collapsible 折叠面板，默认收起，badge 显示数量。

### 规则管理（`/rules`）

- 标题"规则管理"
- 章节折叠卡片：左侧 4px 彩色竖条区分章节
- 规则列表行：ID（monospace）、标题、迷你 sparkline（会话/匹配），点击进详情
- 排序：按引用量降序

### 规则详情（`/rules/[id]`）

- 面包屑：规则管理 > 章节名 > 规则名
- 信息卡：ID、标题、章节链接、来源文件、关键词标签、最后引用时间
- 同章节规则：水平滚动卡片组
- 引用记录：表格视图，列 = 时间、触发关键词、会话 ID，最多 50 条

### 编辑器（`/editor`）

保持三栏布局不变，视觉微调：

- 中文标签
- Publish 按钮保持现有交互

### 版本历史（`/history`）

- 标题"版本历史"
- 时间线视图：左侧时间轴 + 圆点标记，右侧卡片（日期、来源文件 badge、规则数量）
- 无快照时显示空状态插画 + 文案

### 数据分析（`/analytics`）

- 标题"数据分析"
- 统计卡片区（同 Dashboard 风格）
- Top 10 规则：recharts BarChart，带动画 tooltip
- 章节分布：recharts PieChart（环形），legend 显示各章节占比百分比
- 引用趋势：recharts AreaChart，按天/周/月切换

## 视觉风格

### 配色

- 主背景：`slate-950` / `slate-900`
- 卡片背景：`slate-900` + `bg-gradient-to-br from-slate-900 to-slate-900/50`
- 主色调：`indigo-500` / `indigo-400`
- 强调色：`violet-400`（图表第二色）
- 成功：`emerald-500`
- 警告：`amber-500`
- 危险：`rose-500`

### 卡片

- 圆角 `rounded-xl`
- 边框 `border border-slate-800`
- 内边距 `p-6`
- hover 微浮起 `hover:shadow-lg hover:shadow-indigo-500/5 transition-shadow`

### 图表配色

recharts 统一色板：`['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed']`

### 动效

- 统计数字：CSS counter animation（不引入 framer-motion，保持轻量）
- 卡片出现：subtle fade-in
- 图表：recharts 内置动画

## 文件结构

```
src/
├── i18n/
│   ├── index.tsx          # I18nProvider + useI18n hook
│   ├── zh.ts              # 中文字典
│   └── en.ts              # 英文字典
├── components/
│   ├── app-sidebar.tsx    # 重写
│   ├── top-bar.tsx        # 新增
│   ├── stat-card.tsx      # 新增（含 sparkline）
│   ├── term-tooltip.tsx   # 新增
│   └── ui/                # shadcn 现有
├── app/
│   ├── layout.tsx         # 添加 I18nProvider + TopBar
│   ├── page.tsx           # 重写 Dashboard
│   ├── rules/
│   │   ├── page.tsx       # 重写
│   │   └── [id]/page.tsx  # 重写
│   ├── editor/            # 视觉微调
│   ├── history/page.tsx   # 重写
│   └── analytics/page.tsx # 重写
```

## API 变更

需要新增 API 端点支持趋势数据：

- `/api/analytics` 扩展返回 `citation_trend` 字段：`[{date: string, count: number}]`
- 现有 API 端点无需其他变更，返回数据结构不变

## 范围外

- 多用户协作
- 移动端适配（保持响应式但非主要目标）
- 暗色/亮色主题切换
- 服务端 i18n（SSR 翻译）
