# CLAUDE.md 管理器 — 设计文档

> 日期：2026-05-15
> 状态：自审完成，待用户审阅
> 灵感来源：[andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) 对比分析

---

## 背景

当前 `~/.claude/CLAUDE.md` 是一个 171 行的单体文件，包含 15 个 section，没有版本控制，没有使用追踪。在分析了 Karpathy 的 4 条编程原则后，我们发现了两个重要缺口（手术刀原则、显式假设声明），需要一套系统来有效管理和迭代 CLAUDE.md。

## 目标

1. **模块化管理** — 将 CLAUDE.md 拆分为可独立维护的单元，用 git 版本控制
2. **一键回滚** — 任何变更都可以通过 git revert 恢复
3. **可视化仪表盘** — 在本地 Web 应用中浏览规则结构、查看变更差异
4. **引用追踪** — 知道哪些规则在对话中被实际使用，类似论文引用次数
5. **数据驱动迭代** — 识别冷门规则（考虑删除）和热门规则（需要精化）

## 不做的事

- 多人协作（单用户系统）
- 云端部署（纯本地）
- 自动生成规则（人写规则，系统追踪）

---

## 整体架构

### 项目目录

```
repo_ds1600/claude-md-manager/
├── rules/                          # 模块化规则源文件
│   ├── 00_核心原则.md
│   ├── 03_显式假设.md              ← 新增（来自 Karpathy 对比）
│   ├── 07_手术刀原则.md            ← 新增（来自 Karpathy 对比）
│   ├── 10_任务分流.md
│   ├── 15_浏览器规则.md
│   ├── 20_Subagent策略.md
│   ├── 25_模型与并发限制.md
│   ├── 30_E2E测试策略.md
│   ├── 35_安全护栏.md
│   ├── 40_多轮独立Review.md
│   ├── 45_TDD与覆盖率标准.md
│   ├── 50_ChangeDeliveryGate.md
│   ├── 55_不要重复造轮子.md
│   └── 60_覆盖率门禁.md
├── build/
│   └── assemble.py                 # 构建：rules/*.md → ~/.claude/CLAUDE.md
├── web/                            # Next.js 可视化仪表盘
│   ├── package.json
│   └── src/
│       ├── app/                    # 页面路由
│       ├── components/             # UI 组件
│       └── lib/                    # 数据层 + 工具
├── data/
│   ├── usage.db                    # SQLite：规则引用记录
│   └── history/                    # 构建历史快照（用于回滚）
├── hooks/
│   └── session-logger.py           # Claude Code Hook：记录规则引用
├── scripts/
│   ├── init-history.py             # 从历史对话导入 baseline 数据
│   └── export-report.py            # 导出报告
├── CLAUDE.md                       # 本项目自己的 CLAUDE.md
└── README.md
```

### 规则文件格式

每个规则文件使用 YAML frontmatter + Markdown 正文：

```markdown
---
id: task-triage
title: 任务分流
order: 10
tags: [workflow, triage]
rules:
  - id: task-triage.readonly
    title: 只读任务
    keywords: ["只读任务", "分析", "解释", "架构说明", "代码阅读"]
  - id: task-triage.light
    title: 轻量任务
    keywords: ["轻量任务", "单文件", "小范围修改", "明确bug修复"]
  - id: task-triage.medium
    title: 中任务
    keywords: ["中任务", "多文件", "新功能", "重构"]
  - id: task-triage.heavy
    title: 大任务
    keywords: ["大任务", "跨模块", "新架构", "公共API变更"]
---

## 任务分流

### 只读任务
- 分析、解释、架构说明、代码阅读 —— 直接处理。
- 真实 bug 排查但尚未修改 —— 用 systematic-debugging。

### 轻量任务
...
```

设计要点：
- **文件名前缀**（`00_`、`10_`、...）控制拼接顺序
- **frontmatter 中的 `rules` 数组**声明子规则 ID 和关键词
- **每个子规则的 `keywords`** 用于 Hook 匹配和搜索
- **构建脚本**剥离 frontmatter，按 order 拼接正文
- 子规则 ID 格式：`{section-id}.{sub-rule-slug}`

### 新增规则（来自 Karpathy 对比分析）

#### `03_显式假设.md`（中优先级）

解决 "不问就干" 的问题：
- **逐条声明假设** — 动手前列出假设和不确定的点
- **有更简方案时提出** — 遇到比自己选择的更简单的方案，说出来
- **不确定时停下来问** — 不明白就停，说清楚哪里不明白

关键词：假设、assumption、不确定、更简方案、push back、困惑、stop and ask

#### `07_手术刀原则.md`（高优先级）

解决 "diff 膨胀" 的问题：
- **不改相邻代码** — 只改和任务直接相关的代码
- **匹配现有风格** — 即使和自己习惯不同也跟随项目风格
- **只清理自己产生的孤儿** — 自己改动导致的 dead code 才删，预存的不动
- **每行改动可追溯到用户请求** — diff 里每一行都应该能说出为什么改

关键词：相邻代码、adjacent、匹配风格、孤儿代码、dead code、trace、diff膨胀

---

## 组件 1：构建系统（assemble.py）

### 核心流程

```
rules/*.md → assemble.py → ~/.claude/CLAUDE.md
```

### 具体步骤

1. 扫描 `rules/` 目录，按文件名前缀数字排序
2. 解析每个文件的 YAML frontmatter
3. 按顺序拼接所有文件的正文（frontmatter 之后的内容）
4. 在开头添加自动生成标记：`<!-- Built by claude-md-manager at 2026-05-15 19:30 -->`
5. 写入 `~/.claude/CLAUDE.md`
6. 同时保存快照到 `data/history/<timestamp>.md`
7. 如果内容有变化，自动 git commit（commit message 带时间戳和变更的规则 ID）

### 命令行接口

```bash
# 正常构建（写入 + 快照 + git commit）
python build/assemble.py

# 预览（输出到 stdout，不写文件）
python build/assemble.py --dry-run

# 回滚到指定快照
python build/assemble.py --rollback 2026-05-15T19-30-00

# 列出所有可用快照
python build/assemble.py --list-snapshots

# 校验所有规则文件（检查 ID、keywords、格式）
python build/assemble.py --validate
```

### 回滚机制

快照存在 `data/history/` 中，用 git 管理。回滚流程：
1. 按时间戳找到目标快照
2. 将快照内容复制到 `~/.claude/CLAUDE.md`
3. 记录回滚事件

---

## 组件 2：Hook 引用追踪

### Hook 注册

在 `~/.claude/settings.json` 中配置：

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python /path/to/claude-md-manager/hooks/session-logger.py"
      }]
    }]
  }
}
```

### 追踪逻辑

**关键决策**：Claude Code 的 PostToolUse hook 只接收工具上下文（工具名、输入、输出），不传完整对话内容。所以我们的 hook 直接读取当前会话的 JSONL 文件。

1. Hook 在会话结束时触发（Stop 事件或 PostToolUse 空匹配器）
2. 脚本定位当前会话的 JSONL 文件（在 `~/.claude/projects/*/conversations/` 中）
3. Session ID = JSONL 文件名（包含时间戳和唯一 ID）
4. 脚本加载所有规则文件的 frontmatter，构建关键词映射
5. 扫描 JSONL 内容（只看 assistant 消息），做关键词匹配
6. 将匹配结果记录到 SQLite
7. 去重：同一关键词在同一会话中多次匹配只算 1 次引用

### 数据库设计

```sql
-- 规则引用记录
CREATE TABLE rule_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,          -- 如 "task-triage.light"
    session_id TEXT NOT NULL,       -- 对话标识（JSONL 文件名）
    matched_keyword TEXT NOT NULL,  -- 命中的关键词
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话信息
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    model TEXT,
    task_summary TEXT               -- 可选：简短任务描述
);

-- 规则元数据（从 frontmatter 同步）
CREATE TABLE rules_metadata (
    rule_id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    keywords TEXT,                  -- JSON 数组
    source_file TEXT NOT NULL,
    updated_at DATETIME
);

-- 索引
CREATE INDEX idx_refs_rule ON rule_references(rule_id);
CREATE INDEX idx_refs_time ON rule_references(timestamp);
CREATE INDEX idx_refs_session ON rule_references(session_id);
```

### 历史 Baseline 导入

`scripts/init-history.py`：
1. 扫描 episodic memory 中的历史对话
2. 用同样的关键词匹配逻辑分析
3. 导入结果，使用估算时间戳
4. 在 session_id 前缀标记为 "historical" 来源

这样仪表盘从第一天就有数据，不必等积累。

---

## 组件 3：Next.js 可视化仪表盘

### 技术栈

- **框架**：Next.js 14+（App Router）
- **样式**：Tailwind CSS + shadcn/ui
- **图表**：Recharts
- **数据**：SQLite（通过 better-sqlite3，服务端读取）
- **Markdown 渲染**：react-markdown + remark-gfm

### 页面设计

#### `/` 首页仪表盘
- 规则总数、总引用次数、活跃规则占比
- 最近 7 天引用趋势折线图
- 冷门规则预警（30 天内 0 引用的规则）
- 最近构建变更摘要

#### `/rules` 规则总览
- 左侧：规则树（按分类分组，section → 子规则 两级结构）
- 每个节点旁边显示引用次数 badge
- 点击展开规则全文（Markdown 渲染）
- 搜索栏 + 标签筛选
- 排序：按名称、引用次数（升/降）、最近更新

#### `/rules/[id]` 规则详情
- 规则全文（Markdown 渲染）
- 引用趋势图（按天/周/月切换）
- 相关规则（共享标签或同一会话中同时出现）
- 该规则源文件的 git 变更历史
- 编辑按钮 → 在编辑器中打开源文件

#### `/history` 版本时间线
- 按时间排列的构建记录
- 每条记录：时间戳、变更的规则、diff 摘要
- 点击展开内联 diff 视图
- 一键回滚按钮（调用 assemble.py --rollback）

#### `/analytics` 引用分析
- Top 10 热门规则柱状图
- Bottom 10 冷门规则
- 按分类的引用分布饼图
- 热力图：规则 × 时间段
- 新增 vs 废弃规则趋势

### API 路由

```
GET /api/rules          → 规则列表 + 引用次数
GET /api/rules/[id]     → 单条规则详情 + 引用数据
GET /api/citations      → 引用时序数据（可按规则、日期范围筛选）
GET /api/history        → 构建历史列表
GET /api/history/[ts]   → 指定快照的 diff
POST /api/rollback/[ts] → 触发回滚
GET /api/analytics      → 聚合分析数据
```

---

## 实施阶段

### Phase 1：核心（构建系统 + 规则拆分）
- 在 claude-md-manager/ 初始化 git 仓库
- 将现有 CLAUDE.md 拆分为模块文件
- 实现 assemble.py（build、validate、dry-run）
- 新增 Karpathy 启发的规则（手术刀原则、显式假设）
- 首次构建 → 验证输出 = 原 CLAUDE.md + 新规则

### Phase 2：Hook 追踪
- 实现 session-logger.py
- 在 settings.json 中注册 hook
- 实现 init-history.py 导入历史 baseline
- 验证 hook 触发并记录数据

### Phase 3：仪表盘
- 脚手架 Next.js 项目
- 实现 SQLite 数据层
- 构建首页 + 规则总览页
- 构建版本历史页
- 构建引用分析页

### Phase 4：收尾
- README 使用说明
- 项目自己的 CLAUDE.md
- 测试（assemble.py 单元测试、hook 集成测试）

---

## 成功标准

1. `assemble.py` 能从模块文件构建出与手工维护一致的输出
2. `assemble.py --rollback <ts>` 可恢复任意历史版本
3. Hook 在会话结束后 5 秒内记录引用数据
4. 仪表盘展示所有规则及其引用次数
5. Git log 记录每次 CLAUDE.md 变更及 diff
6. 冷门规则（30+ 天无引用）在仪表盘中被醒目标记

---

## 决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 引用追踪方式 | 日志回溯 / Hook / 手动 / 混合 | Hook（+ 历史导入） | 自动化、精确，历史导入补充初始数据 |
| 可视化形式 | 静态 HTML / Markdown 报告 / 本地 Web | 本地 Web 服务 | 交互性最好 |
| 技术栈 | FastAPI / Next.js / 纯 Python | Next.js | 用户偏好 |
| 版本控制策略 | Git + 符号链接 / 模块化构建 / 直接 track | 模块化拆分 + 构建组装 | 粒度可控、diff 清晰 |
| 模块粒度 | Section 级 / Atomic Rule 级 / 两层结构 | 两层结构 | Section 文件 + 子规则 ID，平衡管理成本和追踪粒度 |
| Hook 数据源 | hook stdin / session JSONL | session JSONL | Claude Code hook 不传完整对话，需直接读文件 |
| UI 框架 | 手写 Tailwind / shadcn/ui / MUI | shadcn/ui | 手写 CSS 导致侧边栏遮挡内容，shadcn/ui 基于 Radix UI 原语，布局可靠 |
