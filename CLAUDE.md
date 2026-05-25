# CLAUDE.md Manager — 项目 CLAUDE.md

## 项目概述

模块化管理 `~/.claude/CLAUDE.md`，支持版本控制、规则引用追踪、可视化仪表盘。

## 开发约定

### 构建
```bash
python build/assemble.py              # 构建 + 快照 + git commit
python build/assemble.py --dry-run    # 预览
python build/assemble.py --validate   # 校验规则文件
```

### 测试
```bash
python -m pytest tests/ -v            # 运行所有测试
```

### 仪表盘
```bash
cd web && npm run dev                 # 开发模式 (localhost:3456)
cd web && npm run build               # 生产构建
```
生产环境通过 launchd 自启动，监听 `0.0.0.0:3456`。

### 代码风格
- Python: 类型注解、f-string、pathlib
- TypeScript/React: 函数组件 + hooks，shadcn/ui 组件库
- CSS: shadcn/ui CSS 变量体系，不自定义手写布局

## 架构

```
rules/*.md        → YAML frontmatter + Markdown 正文
build/assemble.py → 按 order 排序拼接 → ~/.claude/CLAUDE.md + 快照
hooks/            → session-logger.py (PostToolUse + Stop) → SQLite 引用记录
                     增量扫描（offset 追踪），提取 model/task_summary
web/              → Next.js 16 + shadcn/ui 仪表盘
data/usage.db     → SQLite (规则元数据 + 引用记录 + 会话信息)
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `build/assemble.py` | 构建系统：拼接规则、快照、回滚 |
| `hooks/session-logger.py` | Hook：扫描 JSONL 记录规则引用 |
| `hooks/db.py` | SQLite 数据层 |
| `web/src/app/layout.tsx` | 仪表盘布局（SidebarProvider + SidebarInset） |
| `web/src/components/app-sidebar.tsx` | 侧边栏导航 |
| `web/src/app/rules/[id]/page.tsx` | 规则详情页 |

## 覆盖率门禁

每次重大迭代完成后必须运行覆盖率统计并报告结果。新代码导致覆盖率低于目标线时，必须先补测试再继续开发。

### 目标（2026-05-25 基线）

| 层 | Stmts | Branch | 当前 Stmts | 当前 Branch |
|----|-------|--------|------------|-------------|
| Python (hooks, build, mcp_lib) | ≥ 95% | — | 99% | — |
| Web — lib/ | ≥ 95% | ≥ 90% | 99.78% | 97.33% |
| Web — i18n/ | ≥ 90% | ≥ 80% | 100% | 88.88% |
| Web — hooks/ | ≥ 90% | ≥ 85% | 96.22% | 95.23% |
| Web — components/ | ≥ 90% | ≥ 80% | 97% | 85.98% |
| Web — app/api/ (API routes) | ≥ 80% | ≥ 70% | 75–95% | — |
| Web — app/pages/ (页面组件) | ≥ 70% | ≥ 60% | 50–95% | — |
| **Web 整体** | **≥ 85%** | **≥ 75%** | **87.1%** | **80.1%** |

### 测试命令

```bash
# Python 覆盖率
python -m pytest tests/ --cov=hooks --cov=build --cov=mcp_lib --cov-report=term-missing

# Web 覆盖率
cd web && PATH="/opt/homebrew/bin:$PATH" npx vitest run --coverage
```

## 已知限制

- Hook 注册需手动在 `~/.claude/settings.json` 添加 PostToolUse 和 Stop 条目
- 仪表盘 API 路由直接读 SQLite，无 ORM
- 会话 model/task_summary 仅在新会话被 hook 处理时填充，历史会话需重新扫描
