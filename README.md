# CLAUDE.md Manager

模块化管理 `~/.claude/CLAUDE.md`，支持版本控制、可视化查看、规则引用频率统计。

## 快速开始

```bash
# 构建并写入 ~/.claude/CLAUDE.md
python build/assemble.py

# 预览（不写文件）
python build/assemble.py --dry-run

# 验证所有规则文件格式
python build/assemble.py --validate

# 列出可回滚的快照
python build/assemble.py --list-snapshots

# 回滚到指定快照
python build/assemble.py --rollback 2026-05-15T21-38-58
```

## 项目结构

```
rules/           # 14 个模块化规则文件（YAML frontmatter + Markdown）
build/           # assemble.py 构建脚本
web/             # Next.js 可视化仪表盘（Phase 3）
data/history/    # 构建快照（用于回滚）
hooks/           # Claude Code Hook（引用追踪）
scripts/         # 工具脚本
```

## 规则文件格式

每个规则文件包含 YAML frontmatter（声明 ID、子规则、关键词）和 Markdown 正文：

```yaml
---
id: surgical-changes
title: 手术刀原则
order: 7
tags: [coding-style, changes]
rules:
  - id: surgical-changes.no-adjacent
    title: 不改相邻代码
    keywords: ["相邻代码", "adjacent", "格式化"]
---
```

构建脚本按 `order` 排序拼接正文，剥离 frontmatter，输出到 `~/.claude/CLAUDE.md`。

## 设计文档

- [英文版](docs/specs/2026-05-15-claude-md-manager-design.md) — for potential open source
- [中文版](docs/specs/2026-05-15-claude-md-manager-design.zh.md) — 中文设计文档

## 实施阶段

- [x] **Phase 1**：构建系统 + 规则拆分 + Karpathy 新规则
- [x] **Phase 2**：Hook 引用追踪 + 历史数据导入（1305 sessions, 7176 matches）
- [x] **Phase 3**：Next.js 可视化仪表盘 + launchd 自启动（`http://0.0.0.0:3456`）
- [x] **Phase 3.1**：迁移到 shadcn/ui（Radix UI + Tailwind CSS），修复侧边栏遮挡问题
- [ ] **Phase 4**：收尾 — Hook 注册、单元测试、项目 CLAUDE.md

### 仪表盘技术栈

- Next.js 16 + React 19 + Tailwind CSS v4
- **shadcn/ui**（Radix UI 原语）— Card, Table, Badge, Sidebar, Collapsible
- better-sqlite3（服务端只读）

### 仪表盘页面

| 页面 | 路径 | 说明 |
|------|------|------|
| Dashboard | `/` | 总览：统计卡片 + Top 10 规则 + 冷规则 |
| Rules | `/rules` | 51 条规则列表，按引用频次排序 |
| Rule Detail | `/rules/[id]` | 单条规则详情 + 引用记录表 |
| History | `/history` | 规则元数据按更新日期分组 |
| Analytics | `/analytics` | Top 10 柱状图 + 分类分布表 |
