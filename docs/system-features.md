# CLAUDE.md Manager — 系统功能清单

> 基于 2026-06-05 代码走读，用于 UI 重做时的功能基线参考。

---

## 1. 系统定位

模块化管理 `~/.claude/CLAUDE.md`——将一条规则拆成独立 `.md` 文件，支持构建发布、版本快照、会话引用追踪、可视化仪表盘。

核心数据流：

```
rules/*.md → assemble.py → ~/.claude/CLAUDE.md + 快照
sessions JSONL → session-logger.py (hook) → SQLite (引用记录)
SQLite → Web API → Next.js 仪表盘
```

---

## 2. 规则管理子系统

### 2.1 规则文件格式

- 路径：`rules/*.md`
- 每个文件 = YAML frontmatter + Markdown 正文
- frontmatter 字段：`id`、`title`、`order`、`rules[]`（子规则列表，每个子规则含 `id`、`title`、`keywords[]`）
- 文件名前缀数字（如 `00_核心原则.md`）不影响排序，排序由 `order` 字段决定

### 2.2 构建系统 (`build/assemble.py`)

| 功能 | 命令 / 触发 | 说明 |
|------|-------------|------|
| 构建 | `python build/assemble.py` | 按 order 排序拼接所有规则 → 写入 `~/.claude/CLAUDE.md` |
| 预览 | `--dry-run` | 输出到 stdout，不写文件 |
| 校验 | `--validate` | 检查 id 唯一性、子规则 id 前缀、keywords 非空、body 非空 |
| 快照 | 自动（构建时） | 每次构建在 `data/history/` 生成 `YYYY-MM-DDTHH-MM-SS.md` 快照 |
| 列出快照 | `--list-snapshots` | 按时间倒序列出所有快照文件名 |
| 回滚 | `--rollback <timestamp>` | 将指定快照覆盖写回 `~/.claude/CLAUDE.md` |
| Git 提交 | 自动（构建时） | 新旧 CLAUDE.md 内容不同时才提交。仅 CLI 直接运行时触发；通过 MCP/Web 发布时由 publish 流程单独管理快照 |

### 2.3 规则草稿系统

- 草稿存储在 SQLite `rule_drafts` 表
- 草稿不影响磁盘上的 `rules/*.md` 文件
- 支持通过 Web 编辑器或 MCP 工具创建/保存/删除草稿
- 发布时：草稿内容 → 写入磁盘 → 运行 assemble.py → 清除草稿

### 2.4 发布系统

| 步骤 | 说明 |
|------|------|
| 预快照 | 在写入磁盘前保存一份当前快照（用于回滚） |
| 验证 | 校验所有草稿的 frontmatter 完整性（仅检查 id、title、order 三个字段，CLI `--validate` 范围更广） |
| 写入 | 草稿内容写入 `rules/*.md` |
| 构建 | 调用 assemble.py 重新生成 `~/.claude/CLAUDE.md` |
| 记录 | 写入 `publish_history` 表（时间、变更规则数、状态） |
| 清理 | 仅在发布成功时删除草稿；失败时草稿保留，用户可修正后重试 |

快照去重：连续相同内容的快照会被自动过滤，不会产生重复历史记录。

---

## 3. 会话追踪子系统

### 3.1 Hook 系统 (`hooks/session-logger.py`)

**触发方式**：在 `~/.claude/settings.json` 注册两个 Hook

| Hook | 触发时机 | 扫描范围 | 用途 |
|------|----------|----------|------|
| PostToolUse | 每次工具调用后 | 增量扫描（从上次 offset 起） | 实时捕获 |
| Stop | 会话结束时 | 仅扫描最后一条 assistant 消息 | 单轮高置信度 |

**核心流程**：

1. 发现最新 session JSONL 文件（`~/.claude/projects/<dir>/*.jsonl`）
2. 解析所有规则文件的 keywords，构建正则 pattern map
3. 扫描 assistant 消息文本，匹配 keywords
4. 去重 + 置信度分类。PostToolUse 模式按关键词长度动态分类（high ≥ 10 字符，medium ≥ 4，low < 4）；Stop Hook 统一使用固定 medium 置信度
5. 写入 `rule_references` 表

**会话元数据提取**：

- `model`：从前 50 条消息中的 assistant 消息提取
- `task_summary`：第一条 user 消息的前 200 字符

**增量扫描**：

- 每次扫描后记录 `last_offset`（行号），下次从该 offset 继续
- 避免重复扫描已完成的消息

### 3.2 关键词匹配策略

| 关键词类型 | 正则策略 | 示例 |
|-----------|----------|------|
| CJK（中文） | 非ASCII字母数字边界 | `手术刀原则` |
| 多词短语（含空格/连字符） | `\w` 边界 | `force push` |
| 纯英文 | `\b` 单词边界 | `TDD` |

### 3.3 置信度来源

| 来源 | source 字段值 | 置信度 | 说明 |
|------|--------------|--------|------|
| MCP `record_citation` 工具 | `mcp_tool` | high | Claude 显式调用，确认触发 |
| Stop Hook | `hook_stop` | medium（固定） | 会话结束时扫描最后一条消息 |
| PostToolUse Hook | `hook_posttool` | 动态分类 | 每次工具调用后自动扫描，按关键词长度判定 |

同一 session 中同一规则的同一关键词只保留一条记录（唯一索引 dedup），但置信度可通过 `ON CONFLICT` 从 low 升级到 medium/high，不会降级。

### 3.4 数据库层 (`hooks/db.py`)

SQLite 数据库：`data/usage.db`

**表结构**：

| 表 | 用途 | 关键字段 |
|----|------|----------|
| `rule_references` | 引用记录 | rule_id, session_id, matched_keyword, confidence, source, timestamp |
| `sessions` | 会话信息 | session_id, started_at, ended_at, model, task_summary, last_offset |
| `rules_metadata` | 规则元数据 | rule_id, section_id, title, keywords, source_file |
| `sections_metadata` | 章节元数据 | section_id, title, source_file, rule_count |
| `rule_drafts` | 草稿 | rule_id, frontmatter_yaml, markdown_body, order_override |
| `publish_history` | 发布历史 | published_at, rules_changed, snapshot_name, status, error_message |

**索引**：rule_references 上有 rule_id、timestamp、session_id，以及 `(rule_id, session_id, matched_keyword)` 唯一索引（dedup），通过 `ON CONFLICT DO UPDATE` 实现置信度只升不降

**特性**：WAL 模式、5 秒 busy_timeout、增量 schema 迁移

### 3.5 CLI 辅助命令

| 命令 | 用途 |
|------|------|
| `python session-logger.py --sync-metadata` | 将 `rules/*.md` 的 frontmatter 同步到 `rules_metadata` 和 `sections_metadata` 表 |
| `python session-logger.py --backfill` | 回填 model 为空的 session 元数据 |
| `python session-logger.py --backfill --all` | 回填 model 或 task_summary 为空的所有 session |

**初始化脚本** (`scripts/init-history.py`)：扫描历史 JSONL 文件，回填 `sessions` 和 `rule_references`，用于首次部署或数据修复。

---

## 4. MCP Server 子系统

### 4.1 工具清单

| 工具 | 用途 | 是否破坏性 |
|------|------|-----------|
| `list_rules` | 列出所有规则（id、title、order、草稿状态） | 否 |
| `get_rule` | 获取规则完整内容（frontmatter + body） | 否 |
| `get_draft` | 获取规则草稿（如存在） | 否 |
| `save_draft` | 保存草稿（不影响磁盘文件） | 否 |
| `delete_draft` | 删除草稿 | 否 |
| `validate_drafts` | 校验所有草稿的 frontmatter | 否 |
| `publish_drafts` | 发布草稿 → 写磁盘 + 构建 + 清除 | **是** |
| `get_claude_md` | 读取当前 `~/.claude/CLAUDE.md` 内容 | 否 |
| `get_publish_history` | 查询发布历史 | 否 |
| `list_snapshots` | 列出可用快照 | 否 |
| `record_citation` | 显式记录高置信度引用 | 否 |

### 4.2 设计原则

- 所有修改走 draft → validate → publish 三步流程
- `publish_drafts` 标记为破坏性操作，需用户确认
- 使用 FastMCP 框架，stdio transport

---

## 5. Web 仪表盘子系统

### 5.1 技术栈

- Next.js 16（App Router）
- React 函数组件 + Hooks
- shadcn/ui 组件库
- Recharts 图表库
- better-sqlite3（服务端直接读 SQLite）
- i18n（中英双语）
- 生产环境：launchd 自启动，监听 `0.0.0.0:3456`

### 5.2 页面清单

#### 5.2.1 Dashboard（首页 `/`）

**数据源**：`GET /api/rules`（支持 `days` 参数筛选时间范围）

| 区域 | 功能 |
|------|------|
| 顶部统计卡片（6 个） | 总规则数（副标签显示章节数，可跳转 /rules）、总会话数（可跳转 /sessions）、活跃率（百分比）、引用总数（含趋势迷你图，可跳转 /analytics）、平均覆盖率（百分比）、平均深度 |
| 模型分布图 | 自定义 CSS 水平进度条列表（非 Recharts），按 model 统计会话数 |
| 引用趋势图 | Area 折线图，按天/自定义时间范围 |
| 会话趋势图 | Area 折线图，按天统计会话数 |
| 章节概览图 | 横向 Bar 图，每章节引用数（可点击跳转 rules 页筛选） |
| Top 10 规则图 | 横向 Bar 图，最高引用规则（可点击跳转规则详情） |
| 最近引用列表 | 最新 8 条引用记录（keyword + section + rule + session + model + 置信度指示器 + 时间） |
| 最近会话列表 | 最新 8 个会话（ID + 时间 + 模型 + 摘要 + 规则/引用数） |
| 最近构建列表 | 最新 5 次构建（状态 + 规则数 + 时间） |
| 冷规则列表（可折叠） | 引用最少的 10 条规则（可折叠展开） |

**时间筛选**：全部 / 7 天 / 30 天 / 90 天

**交互**：
- 刷新按钮（带 loading 动画）
- 最后更新时间显示
- 最后活动时间显示
- 图表点击跳转（章节 → rules 页筛选，规则 → 规则详情）
- 部分 StatCard 可点击跳转（总规则 → /rules，总引用 → /analytics，总会话 → /sessions；活跃率、覆盖率、深度不可跳转）

#### 5.2.2 Rules 页面 (`/rules`)

**数据源**：`GET /api/rules`

| 功能 | 说明 |
|------|------|
| 章节折叠列表 | 按章节分组，每章节可折叠/展开 |
| 搜索 | 标题、rule_id、keyword、source_file 模糊搜索，支持 ⌘K |
| 章节筛选 | 按钮组筛选特定章节 |
| 排序 | 默认（按 order）/ 匹配数 / 覆盖率 / 深度 / 引用占比，支持升降序切换 |
| 全部展开/折叠 | 一键展开或折叠所有章节 |
| 规则行 | 显示标题、匹配数、覆盖率进度条、深度指示器、引用占比 |
| 面包屑导航 | Home → Rules |
| URL 参数同步 | section / sort / dir / search 参数反映在 URL 中 |

#### 5.2.3 规则详情页 (`/rules/[id]`)

**数据源**：`GET /api/rules/[id]`

| 区域 | 功能 |
|------|------|
| 头部信息 | rule_id（可复制）、标题、所属章节（链接）、源文件、最后引用时间 |
| 编辑入口 | 跳转到编辑器页面（预选该规则） |
| 三列指标 | 覆盖率（session 覆盖）、深度（平均激活次数）、引用占比 |
| 关键词标签 | 显示所有 keywords，点击跳转搜索 |
| 规则内容 | Markdown 渲染，显示字数/行数，可复制 |
| 同章节规则 | 横向卡片列表，显示同章节的兄弟规则及指标 |
| 共现规则 | 横向卡片列表，同一 session 中频繁共现的规则 |
| 引用趋势图 | Area 折线图，时间范围可切换（全部/7d/30d/90d） |
| 引用记录表 | 桌面：表格（时间/关键词/模型/置信度/session）<br>移动：卡片布局 |
| 分页加载 | "Load More" 按钮，每次加载 50 条 |

**交互**：
- 面包屑导航（Home → Rules → 章节名 → 规则名）
- 复制 rule_id、复制内容
- 点击关键词 → 跳转 rules 搜索
- 点击同章节/共现规则 → 跳转对应规则详情

#### 5.2.4 Sessions 页面 (`/sessions`)

**数据源**：`GET /api/sessions`

| 功能 | 说明 |
|------|------|
| 会话列表 | ID（前 8 位，可点击复制）、时间、模型标签、持续时间、任务摘要 |
| 搜索 | 搜索 session ID 或 task_summary，⌘K |
| 时间筛选 | 全部 / 7 天 / 30 天 / 90 天 |
| 模型筛选 | 下拉选择 model |
| 置信度筛选 | 下拉选择 high/medium/low |
| 排序 | 时间 / 引用数 / 规则数 / 持续时间 |
| 分页 | 上一页 / 下一页，每页 50 条 |
| 键盘导航 | j/k（或方向键）上下选择，Enter 进入详情。注意：当前代码未做焦点保护，在搜索框中输入 j/k 也会同时触发导航——UI 重做时需增加焦点保护 |
| 统计 Badge | 总会话数、平均持续时间、平均引用数 |

#### 5.2.5 会话详情页 (`/sessions/[id]`)

**数据源**：`GET /api/sessions/[id]`

| 区域 | 功能 |
|------|------|
| 头部信息 | Session ID（可复制）、模型、规则数/引用数 |
| 置信度分布 | high/medium/low 计数 |
| 任务摘要 | task_summary 文本 |
| 时间范围 | 起止时间 + 持续时间 |
| 命中章节 | 彩色 Badge 列表，可点击跳转 |
| 时间轴 | 引用在会话时间线上的可视化（彩色圆点，tooltip 显示规则名） |
| 引用记录表 | 桌面：表格（时间/规则名/章节/关键词/置信度）<br>移动：卡片布局 |

#### 5.2.6 Editor 页面 (`/editor`)

**数据源**：`GET /api/editor/rules`、draft CRUD API

| 区域 | 功能 |
|------|------|
| 规则列表面板 | 三栏自适应布局的左栏，显示所有规则，标记草稿状态，支持拖拽排序 |
| 编辑面板 | 三栏自适应布局的中栏，YAML frontmatter + Markdown body 双编辑区 |
| 预览面板 | 三栏自适应布局的右栏，实时 Markdown 渲染 |
| 工具栏 | 保存草稿 / 丢弃草稿 / ⌘S 快捷保存 |
| 发布按钮 | 顶部，显示未保存草稿数，点击弹出确认对话框 |
| 发布历史 | 底部可折叠，显示历史发布记录 |

**交互**：
- ⌘S 保存草稿
- 未保存变更提示（浏览器 beforeunload + 标签页标题 ● 标记）
- 选择规则时自动加载草稿（如有）或磁盘版本
- URL 参数 `?rule=<id>` 预选规则
- 发布后自动刷新规则列表

#### 5.2.7 History 页面 (`/history`)

**数据源**：`GET /api/history`

| 功能 | 说明 |
|------|------|
| 快照时间轴 | 按日期分组的时间轴视图，左侧竖线连接 |
| 快照卡片 | 版本号（按时间倒序排列后的序号）、时间戳、文件大小、增减行数统计（与前一版本快照的差异） |
| 快照选择 | 复选框，最多选 2 个用于比较 |
| Diff 对比 | 选择 2 个快照后点击 Compare，显示逐行 diff（+绿色/-红色） |
| 内容查看 | 点击 View Content，在页面内渲染 Markdown 快照内容 |
| 回滚 | 两步确认：先点击 Rollback，再点击 Confirm |
| 回滚状态提示 | 3 秒自动消失的成功/失败提示 |

#### 5.2.8 Analytics 页面 (`/analytics`)

**数据源**：`GET /api/analytics`

| 区域 | 功能 |
|------|------|
| 统计卡片（5 个） | 总规则、总引用、总会话、平均覆盖率、平均深度 |
| Top 10 规则图 | 横向 Bar 图（可点击跳转规则详情），tooltip 含覆盖率/深度 |
| 章节分布饼图 | 环形图，显示各章节引用占比（可点击跳转筛选） |
| 引用趋势图 | Area 折线图，支持日/周/月聚合切换 |
| 置信度分布 | 堆叠进度条 + 可展开详情（描述、来源、Top 规则列表） |
| 活动热力图 | 规则 × 日期的热力矩阵（颜色深浅 = 引用密度） |
| 冷规则列表 | 引用最少的规则，显示引用数和最后引用时间。无冷规则时显示绿色的 "All rules are active" 图标 |
| CSV 导出 | 导出 Top 规则数据为 CSV 文件 |

**空状态**：引用趋势、热力图在无数据时显示 "No data available" 占位文本

**时间筛选**：全部 / 7 天 / 30 天 / 90 天

### 5.3 API 路由清单

| 路由 | 方法 | 用途 |
|------|------|------|
| `GET /api/rules` | GET | Dashboard + Rules 页数据（含规则统计、趋势、最近引用/会话/构建） |
| `GET /api/rules/[id]` | GET | 规则详情（规则内容 + 引用记录 + 兄弟规则 + 共现规则） |
| `GET /api/sessions` | GET | 会话列表（分页、搜索、排序、筛选） |
| `GET /api/sessions/[id]` | GET | 会话详情（引用记录 + 命中章节） |
| `GET /api/analytics` | GET | 分析数据（Top 规则、章节分布、趋势、热力图、置信度、冷规则） |
| `GET /api/citations` | GET | 引用数据查询（按 rule/group_by） |
| `GET /api/health` | GET | 健康检查 |
| `GET /api/history` | GET | 快照列表（含 diffStats） |
| `GET /api/history/[ts]` | GET | 快照内容 |
| `GET /api/history/diff` | GET | 两个快照的 diff 结果 |
| `POST /api/history/rollback` | POST | 回滚到指定快照 |
| `GET /api/editor/rules` | GET | 编辑器规则列表（含草稿状态） |
| `GET /api/editor/rules/[id]/draft` | GET | 获取规则草稿 |
| `PUT /api/editor/rules/[id]/draft` | PUT | 保存规则草稿 |
| `DELETE /api/editor/rules/[id]/draft` | DELETE | 删除规则草稿 |
| `POST /api/editor/reorder` | POST | 重新排序规则 |
| `POST /api/editor/publish` | POST | 发布所有草稿 |
| `GET /api/editor/publish-history` | GET | 发布历史 |
| `POST /api/editor/validate` | POST | 验证草稿 |

### 5.4 共享组件

| 组件 | 用途 |
|------|------|
| `AppSidebar` | 侧边栏导航（6 个页面 + 草稿数 Badge + 今日会话数 Badge（通过 `GET /api/sessions?days=1&limit=1` 获取） + 构建状态指示灯） |
| `StatCard` | 统计卡片（数值 + 百分比模式 + 趋势迷你图 + 链接跳转） |
| `TermTooltip` | 术语解释 Tooltip（覆盖率、深度、引用、冷规则等） |
| `TopBar` | 顶部栏 |
| `ErrorBoundary` | 图表错误边界 |
| `PageStates` | 页面级 Loading / Error / Skeleton 状态 |
| `MetricVisualizations` | 详情页指标条、深度仪表 |
| `CitationHeatmap` | 引用热力图矩阵 |
| `RuleRow` | 规则列表行组件 |

### 5.5 共享 Hooks

| Hook | 用途 |
|------|------|
| `useFetch` | 统一数据获取（loading/error/data/refresh/fetchedAt） |
| `useChartTheme` | 图表主题（读取 CSS 变量适配深/浅色） |
| `useChartTooltip` | 图表 Tooltip 样式 |
| `usePageTitle` | 页面标题（i18n key → document.title） |
| `useDynamicPageTitle` | 动态页面标题（规则名/session ID） |
| `useMobile` | 响应式检测 |

### 5.6 共享工具库

| 模块 | 用途 |
|------|------|
| `db.ts` | SQLite 查询层（规则统计、会话筛选、分析聚合、热力图、置信度分布） |
| `editor-db.ts` | 编辑器数据库操作（草稿 CRUD、发布、验证） |
| `api-handler.ts` | API 错误处理 |
| `api-utils.ts` | API 工具（时间参数解析、枚举校验、趋势零填充） |
| `chart-colors.ts` | 图表颜色常量 |
| `diff.ts` | 文本 diff 算法 |
| `snapshots.ts` | 快照文件管理 |
| `relative-time.ts` | 相对时间格式化 |
| `types.ts` | TypeScript 类型定义（20+ 接口） |
| `fetch.ts` | 客户端 fetch 封装 |
| `utils.ts` | 通用工具函数 |

### 5.7 国际化

- 中英双语（`web/src/i18n/zh.ts` + `en.ts`）
- 架构：以 `zh.ts` 为 Dict 类型定义（主语言），`en.ts` 实现同一接口
- 约 130+ 个 i18n key
- 覆盖所有 UI 文本（导航、页面标题、表格头、按钮、提示、错误信息、术语解释）

### 5.8 全局交互

| 功能 | 说明 |
|------|------|
| 侧边栏 | shadcn/ui Sidebar，显示应用标题/副标题、6 个导航项、GitHub 链接、版本号 |
| 面包屑 | 所有内页都有 Home → ... → 当前页 的面包屑 |
| 深色主题 | 全局深色主题，CSS 变量驱动 |
| 响应式 | 移动端适配（会话详情/规则详情的表格 → 卡片布局） |
| ⌘K | Rules、Sessions 页面搜索框快捷键 |
| ⌘S | Editor 页面保存草稿 |
| Toast 通知 | sonner 组件，操作反馈（保存成功、发布成功、复制成功等） |
| Skeleton 加载 | 每个页面有专属 Skeleton 占位 |
| 错误边界 | 图表组件有独立错误边界，页面有全局错误页 |
| 404 页 | 自定义 not-found 页面 |
| 刷新 | Dashboard、Analytics、Sessions 页有刷新按钮 |

---

## 6. 数据模型关系

```
sections_metadata (1) ←→ (N) rules_metadata (1) ←→ (N) rule_references
                                                      (N) ←→ (1) sessions

rule_drafts (独立，通过 rule_id 关联 rules_metadata)
publish_history (独立，记录构建事件)
```

---

## 7. 部署架构

| 组件 | 运行方式 | 监听 |
|------|----------|------|
| Web 仪表盘 | Next.js 生产构建 + launchd 自启动 | `0.0.0.0:3456` |
| Hook | Claude Code settings.json 注册 | 由 Claude Code 触发 |
| MCP Server | `python mcp_server.py`（stdio） | 由 Claude Code 调用 |
| SQLite | 本地文件 `data/usage.db` | — |

---

## 8. 术语表

| 术语 | 含义 |
|------|------|
| Citation（引用） | 规则在 Claude 会话中被匹配到一次 |
| Coverage（覆盖率） | 命中该规则的 session 数 / 总 session 数 |
| Depth（深度） | 该规则的总匹配次数 / 命中该规则的 session 数 |
| Share（占比） | 该规则的匹配次数 / 总匹配次数 |
| Confidence（置信度） | 引用的可信程度（high/medium/low），由来源决定 |
| Cold Rule（冷规则） | 引用最少的规则 |
| Snapshot（快照） | 构建时保存的完整 CLAUDE.md 备份 |
| Draft（草稿） | 未发布的规则修改，存储在数据库中 |
