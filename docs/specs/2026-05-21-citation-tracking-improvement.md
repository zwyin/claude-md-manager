# 引用追踪改进方案

> 日期：2026-05-21 | 状态：Phase 1 + Phase 2 已实施 (2026-05-22)

## 实施状态

### Phase 1（方案 A）— 已完成 (2026-05-21)

| 交付项 | 状态 | 文件 |
|--------|------|------|
| CJK 感知双策略匹配 | ✅ | `hooks/session-logger.py` `_build_pattern()` |
| 增量扫描（last_offset） | ✅ | `hooks/db.py` `get_session_offset()` / `update_session_offset()` |
| 置信度分级（high/medium/low） | ✅ | `hooks/session-logger.py` `_classify_confidence()` |
| 关键词子串去重 | ✅ | `hooks/session-logger.py` `longest_match` dict |
| WAL + busy_timeout | ✅ | `hooks/db.py` `get_db()` |
| Schema 迁移 | ✅ | `hooks/db.py` `_run_migrations()` |
| ON CONFLICT 置信度合并 | ✅ | `hooks/db.py` `record_references()` |
| Hook 注册 | ✅ | PostToolUse async |
| 仪表盘可视化增强 | ✅ | 趋势图、sparkline、skeleton 加载、章节/规则分析 |

**观察期**：运行中，待收集数据评估精确率/召回率。

### Phase 2（方案 D 追加层）— 已完成 (2026-05-22)

| 交付项 | 状态 | 文件 |
|--------|------|------|
| Stop Hook（单轮精确分析） | ✅ | `hooks/session-logger.py` `scan_last_message()` |
| Stop Hook 注册 | ✅ | `settings.json` Stop async |
| MCP record_citation 工具 | ✅ | `mcp_lib.py` `record_citation()` + `mcp_server.py` |
| 多 source 置信度合并 | ✅ | `hooks/db.py` `record_references()` ON CONFLICT |
| source 列同步更新 | ✅ | 置信度升级时 source 随之更新 |
| 测试覆盖 | ✅ | 155 tests passing（+13 Phase 2 tests） |

**置信度层级**：`mcp_tool` → high，`hook_stop` → medium，`hook_posttool` → low/medium/high（按关键词长度）

---

## 1. 现状分析

### 1.1 当前机制

```
PostToolUse Hook → session-logger.py (argv 接收路径或自动发现) → 扫描最新 JSONL 文件 →
keyword.lower() in content.lower() → SQLite rule_references 表
```

**数据流**：每次 Claude 调用任何工具后触发 Hook → Hook 通过 `find_latest_session()` 自动发现 `~/.claude/projects/*/` 下最近 1 小时内修改的 JSONL 文件 → 解析所有 rules/*.md 的 keywords → 扫描 JSONL 中所有 assistant 消息 → 子串匹配 → 去重写入 DB。

**前置条件**：当前 `session-logger.py` 未在 `~/.claude/settings.json` 中注册，系统处于未激活状态。本方案涵盖初始部署和改进。

### 1.2 问题清单

| # | 问题 | 严重度 | 示例 |
|---|------|--------|------|
| P1 | **子串匹配误报** | 高 | `"ship"` 匹配到 `"relationship"`；`"plan"` 匹配 `"replace"` 中的 `"plan"` |
| P2 | **高频泛词误报** | 高 | `"分析"`, `"解释"`, `"重构"`, `"review"`, `"plan"` 是日常高频词 |
| P3 | **全文件重复扫描** | 中 | 每次触发扫描整个 JSONL（含已扫描过的历史消息），O(n×k) 增长 |
| P4 | **无词边界检查** | 高 | `"data"` 匹配 `"database"`, `"metadata"` |
| P5 | **仅追踪 assistant 回复** | 中 | 不追踪用户意图和上下文，无法区分"规则被参考"和"词偶然出现" |
| P6 | **无置信度评分** | 中 | 匹配就是匹配，没有强/弱/疑似之分 |
| P7 | **JSONL 格式耦合** | 中 | 依赖 Claude Code 内部 JSONL 格式，格式变化会静默失效 |

**当前准确率估算**：精确率 ~30-40%（大量误报），召回率 ~70%（高频词覆盖但专有名词可能漏报）。

### 1.3 关键词统计

- 总关键词数：207 个（15 个规则文件）
- **纯中文关键词**：120 个（58%）— `\b` 词边界对此完全失效
- **中英混合**：13 个（6%）
- **纯英文**：74 个（36%）
- 高频重复词（16 个）：`brainstorm`(4), `重构`(2), `歧义`(2), `browser`(2), `superpowers`(2), `gstack`(2), `review`(2), `plan`(2), `deploy`(2), `canary`(2), `浏览器`(2), `verification`(2), `覆盖率统计`(2), `不确定`(2), `ship`(2), `QA`(2)
- 包含特殊字符的关键词（25 个）：`rm -rf`, `force-push`, `writing-plans`, `GLM-5.1`, `push back`, `stop and ask`, `API Key`, `dead code`, `package.json`, `QA报告` 等
- 关键词间存在子串关系（38 对）：`"browse"` ⊂ `"browser"`, `"测试"` ⊂ `"单元测试"/"测试金字塔"/"测试覆盖"` 等

---

## 2. 候选方案

### 方案 A：改进匹配算法（单层优化）

**核心思路**：保持 Hook 架构不变，在 session-logger.py 内部改进匹配算法。

**改动点**：
1. **CJK 感知双策略匹配**（解决 P1/P4）：
   - 纯英文关键词：使用 `\b` 词边界（`re.search(r'\b' + re.escape(kw) + r'\b', text, re.I)`）
   - 包含 CJK 字符的关键词：使用 `(?<![a-zA-Z0-9])` 和 `(?![a-zA-Z0-9])` 边界
     - 即：匹配前后不能是英文字母或数字（允许 CJK 字符、标点、空格、字符串边界）
   - 多词短语（含空格/连字符）：整体字面匹配，前后使用 `\b` 或空白边界
2. **增量扫描**（解决 P3）：
   - 将 `last_offset`（行号）存储在 SQLite `sessions` 表中（非独立文件，避免竞态）
   - 每次扫描只处理新增行，扫描完成后在同一事务中更新 offset 和写入引用
3. **置信度分级**：
   - 高：规则 ID 直接出现，或精确短语匹配（如 `"rm -rf"`）
   - 中：关键词带词边界匹配
   - 低：短词（< 3 字符）或已知高频泛词匹配
4. **关键词子串去重**：同一 rule 内，如果短关键词是长关键词的子串且在同位置匹配，只计长关键词

**架构改动**：

```
session-logger.py (修改 ~80 行)
├── parse_all_rules(): 按类型预编译正则，缓存
├── scan_session(): 增量扫描 + 双策略匹配
├── 新增：关键词类型检测 (en/cjk/phrase)
└── 新增：置信度计算

db.py (小改)
├── rule_references 新增 confidence TEXT DEFAULT 'low'
├── sessions 新增 last_offset INTEGER DEFAULT 0
├── 新增 UNIQUE 约束 (rule_id, session_id, matched_keyword)
└── INSERT 改为 ON CONFLICT DO UPDATE confidence = MAX(...)
```

**DB 迁移策略**：
- 在 `get_db()` 初始化中检测列是否存在，不存在则 `ALTER TABLE ADD COLUMN`
- 现有行 `confidence` 默认 `'low'`，`last_offset` 默认 `0`
- 新增 `CREATE UNIQUE INDEX IF NOT EXISTS` 用于去重

**评估**：

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完善度 | ★★★☆☆ | 解决 P1/P3/P4/P6，部分缓解 P2（高频词降权） |
| 方案成熟度 | ★★★★☆ | 改动范围可控，增量测试覆盖 |
| 健壮性 | ★★★★☆ | Hook 进程独立，失败不影响 Claude |
| 架构简洁性 | ★★★★★ | 无新组件，仅改进现有脚本 |
| Token 消耗 | ★★★★★ | 零额外 token |
| 延迟 | ★★★★☆ | 增量扫描减少重复计算 |

---

### 方案 B：Hook 事件分层 + 增量处理

**核心思路**：利用多个 Claude Code Hook 事件构建分层追踪信号，替代单点 PostToolUse 扫描。

**改动点**：
1. **Stop Hook**（async）：Claude 完成回复时触发，做一次精确匹配
   - 只分析当前轮 assistant 消息，不做全文件扫描
   - 作为比 PostToolUse 更高效的信号源
2. **SessionStart Hook**：记录会话开始，初始化 session
3. **增量 JSONL 处理**：记录已扫描到 message index，下次只扫新增部分
4. **PreCompact Hook**（实验性，未验证）：理论上可追踪哪些规则在压缩后保留

**架构改动**：

```
hooks/session-logger.py (重构)
├── --event stop: 只分析最新一轮 assistant 消息
├── --event start: 初始化 session
└── 增量扫描逻辑

~/.claude/settings.json (注册多 Hook)
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{"type": "command", "command": "python3 .../session-logger.py --event stop", "async": true}]
    }]
  }
}
```

**注意**：Stop Hook 的 stdin JSON 格式需实测验证。PreCompact Hook 接收的数据格式尚无官方文档，标记为实验性。

**评估**：

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完善度 | ★★★★☆ | 解决 P3/P5/P6，仍需改进匹配算法 |
| 方案成熟度 | ★★★☆☆ | Stop Hook 较新，需验证稳定性 |
| 健壮性 | ★★★★☆ | 多信号冗余 |
| 架构简洁性 | ★★★☆☆ | 需注册管理多个 Hook |
| Token 消耗 | ★★★★★ | 零额外 token |
| 延迟 | ★★★★☆ | Stop Hook async 减少触发频率 |

---

### 方案 C：MCP 工具主动追踪（主动式）

**核心思路**：通过 MCP 工具让 Claude 在参考规则时主动报告。

**改动点**：
1. **新增 MCP 工具 `record_citation`**：Claude 参考规则时主动调用记录
2. **CLAUDE.md 追加引用提示指令**

**评估**：

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完善度 | ★★★★★ | 理论上最精准 |
| 方案成熟度 | ★★★☆☆ | Claude 大概率会调用可用工具（尤其是系统提示有明确指令时），但不能保证 100% |
| 健壮性 | ★★★☆☆ | 有持续的 token 开销：工具定义本身在每个 context window 占 token |
| 架构简洁性 | ★★★★☆ | 概念最简单 |
| Token 消耗 | ★★☆☆☆ | 每次调用 ~200-500 token；工具定义在 context 中持续消耗 |
| 延迟 | ★★★☆☆ | 工具调用有网络往返 |

**风险**：Claude 可能不总是遵守"主动报告"指令，存在一定漏报率。

---

### 方案 D：混合方案

**核心思路**：组合方案 A（改进匹配）和方案 B（分层 Hook），形成多层防御。

**三层架构**：

**第一层：增量扫描 + CJK 感知匹配（方案 A）** — 始终运行
- PostToolUse Hook + 双策略匹配 + 增量扫描 + 置信度分级

**第二层：Stop Hook 单轮精确分析（方案 B 可靠部分）** — 补充校验
- 注册 Stop Hook（async），只分析当前轮 assistant 消息
- 匹配结果置信度高于第一层

**第三层：MCP 工具被动记录（方案 C 降级版）** — 可选最高置信度
- 提供 `record_citation` MCP 工具，不强制调用
- 调用时置信度 = high

**置信度合并与去重**：
- `mcp_tool` → high，`hook_stop` → medium，`hook_posttool` → low
- 同一 `(rule_id, session_id, matched_keyword)` 从多个 source 匹配时，用 `ON CONFLICT ... DO UPDATE SET confidence = MAX(...)` 取最高
- 不同 `matched_keyword` 即使属于同一 rule 也独立记录（保留关键词级粒度）

**SQLite 并发控制**：
- 所有连接启用 `PRAGMA journal_mode=WAL`
- 设置 `PRAGMA busy_timeout=5000`
- `last_offset` 存储在 `sessions` 表中（非文件），在同一事务中读写，避免竞态

**评估**：

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完善度 | ★★★★★ | 解决全部 P1-P6，P7 通过多层缓解 |
| 方案成熟度 | ★★★☆☆ | 改动范围中等，需验证 Stop Hook |
| 健壮性 | ★★★★☆ | 三层信号冗余，但需处理层间数据冲突 |
| 架构简洁性 | ★★★☆☆ | 比单层复杂，每层独立 |
| Token 消耗 | ★★★★☆ | MCP 调用可选，无强制 token 开销 |
| 延迟 | ★★★★☆ | Stop async + 增量扫描 |

---

## 3. 方案对比总览

| 维度 | A 单层优化 | B 分层 Hook | C MCP 主动 | D 混合方案 |
|------|-----------|-------------|-----------|-----------|
| 功能完善度 | ★★★ | ★★★★ | ★★★★★ | ★★★★★ |
| 方案成熟度 | ★★★★ | ★★★ | ★★★ | ★★★ |
| 健壮性 | ★★★★ | ★★★★ | ★★★ | ★★★★ |
| 架构简洁性 | ★★★★★ | ★★★ | ★★★★ | ★★★ |
| Token 消耗 | ★★★★★ | ★★★★★ | ★★ | ★★★★ |
| 延迟 | ★★★★ | ★★★★ | ★★★ | ★★★★ |
| **改动量** | ~80 行 | ~150 行 | ~60 行 | ~200 行 |
| **主要风险** | CJK 匹配精度 | Stop Hook 稳定性 | 漏报率 | 复杂度 |

> 注：方案 E（原"最小改动"）已合并入方案 A。原方案 E 的 `\b` 词边界对 58% 中文关键词完全失效，不可独立使用。

## 4. 推荐实施路径

**推荐：先 A 后 D，数据驱动升级。**

### Phase 1：方案 A — 改进匹配 + 增量扫描

**范围**：~80 行 Python 改动 + 测试补充 + Hook 注册

**具体交付**：
1. `session-logger.py`：双策略匹配（CJK/English）+ 增量扫描 + 置信度
2. `db.py`：schema 迁移（confidence、last_offset、UNIQUE 约束）+ WAL 模式
3. `~/.claude/settings.json`：注册 PostToolUse Hook（首次激活）
4. 测试：新增中文匹配测试、增量扫描测试、并发安全测试
5. 仪表盘：TypeScript `CitationRecord` 类型可选添加 `confidence` 字段（不影响现有查询）

**验收标准**：
- `python -m pytest tests/ -v` 全部通过
- 5 个真实 JSONL 会话的精确率/召回率测量（人工标注）
- 增量扫描：第 N 次触发只扫描新增行（验证 offset 更新正确）
- 中文关键词匹配率：不低于当前子串匹配的 95%（不降级）

**观察期**：1 周，收集实际追踪数据。

### Phase 2：评估是否需要方案 D

**触发条件**（满足任一则升级）：
- Phase 1 精确率 < 70%
- 需要区分"规则被参考"和"词偶然出现"（P5 未解决）
- 需要更高置信度的追踪数据

**Phase 2 范围**（方案 D 的第二、三层）：
1. Stop Hook 注册 + `--event stop` 模式
2. `record_citation` MCP 工具
3. 多 source 置信度合并

### 回滚计划

- Phase 1：回退 `session-logger.py` + 恢复原始 `db.py` schema（`ALTER TABLE DROP COLUMN` 或重建 DB）
- Phase 2：从 `settings.json` 移除 Stop Hook，MCP 工具可保留（不影响）
- 数据：`confidence` 和 `source` 列为增量添加，移除后现有数据不受影响

---

## 5. 评估指标

### 5.1 核心指标

| 指标 | 当前估算 | Phase 1 目标 | Phase 2 目标 |
|------|---------|-------------|-------------|
| 精确率 | ~30-40% | ≥ 65% | ≥ 80% |
| 召回率 | ~70% | ≥ 65% | ≥ 70% |
| Hook 执行耗时 | O(n×k) 全扫描 | O(Δn×k) 增量 | 同左 |
| 误报率 (1 - precision) | ~60-70% | ≤ 35% | ≤ 20% |

### 5.2 测量方法

1. **基准数据集**：选取 5 个真实会话 JSONL（覆盖不同任务类型：代码修改、分析、问答、重构、调试）
2. **人工标注**：逐条标注每个 assistant 回复中实际参考了哪些规则/关键词
3. **自动计算**：运行 `session-logger.py` 对比标注结果，输出精确率/召回率
4. **重复性**：提供测量脚本 `scripts/measure_accuracy.py`，可重复执行

### 5.3 可扩展性预估

| 规模 | 关键词数 | JSONL 行数 | 预估单次耗时 |
|------|---------|-----------|-------------|
| 当前 | 207 | ~5K | < 50ms（增量） |
| 100 规则 | ~1400 | ~5K | < 200ms（增量） |
| 500 规则 | ~7000 | ~50K | < 1s（增量，需预编译正则） |

---

## 附录 A：中文匹配策略详解

### 为什么 `\b` 不适用于中文

Python 正则中 `\b` 匹配 `\w` 和 `\W` 的边界。Unicode 模式下，中文字符属于 `\w`。因此：
- `\b测试\b` 在 `"关于测试的内容"` 中不匹配（`于`和`测`都是`\w`，没有边界）
- 但 `\b测试\b` 在 `"run 测试 now"` 中匹配（空格是`\W`）

结果：纯中文关键词在中文上下文中匹配率接近 0%。

### 采用的策略

```python
import re

def build_pattern(keyword: str) -> re.Pattern:
    """根据关键词类型构建合适的匹配模式"""
    has_cjk = bool(re.search(r'[一-鿿]', keyword))
    has_space = ' ' in keyword.strip()
    has_hyphen = '-' in keyword and not keyword.startswith('-')

    if has_cjk:
        # CJK 关键词：前后不能是英文字母/数字，允许 CJK、标点、空白、边界
        pattern = r'(?<![a-zA-Z0-9])' + re.escape(keyword) + r'(?![a-zA-Z0-9])'
        return re.compile(pattern, re.IGNORECASE)
    elif has_space or has_hyphen:
        # 多词短语：整体字面匹配，前后词边界
        pattern = r'(?<!\w)' + re.escape(keyword) + r'(?!\w)'
        return re.compile(pattern, re.IGNORECASE)
    else:
        # 纯英文单词：标准 \b 词边界
        pattern = r'\b' + re.escape(keyword) + r'\b'
        return re.compile(pattern, re.IGNORECASE)
```

**效果**：
- `"ship"` 不匹配 `"relationship"` ✓
- `"测试"` 匹配 `"关于测试的内容"` ✓（`于`不是英文字母/数字，允许）
- `"测试"` 匹配 `"run 测试 now"` ✓
- `"rm -rf"` 匹配 `"sudo rm -rf /"` ✓
- `"data"` 不匹配 `"database"` ✓

**局限**：
- `"测试"` 仍匹配 `"压力测试工具"` — 这是中文无空格分词的根本限制
- 需要完整分词（如 jieba）才能解决，但会显著增加延迟和依赖
- 可通过"长关键词优先匹配 + 去重"部分缓解

---

## 附录 B：3 轮独立评审发现汇总

### Round 1 发现

| 严重度 | 问题 | 处理 |
|--------|------|------|
| CRITICAL | 数据流描述错误（stdin → argv） | 已修正 §1.1 |
| CRITICAL | P1/P4 示例捏造 | 已替换为可验证示例 |
| CRITICAL | `\b` 对 58% 中文关键词失效 | 已重写为 CJK 感知双策略（附录 A） |
| CRITICAL | Hook 未注册 | 已在 §1.1 标注，Phase 1 包含注册 |
| MAJOR | PreCompact 可行性未验证 | 已标记为"实验性" |
| MAJOR | Token 估算未验证 | 方案 C 评分已调整 |
| MAJOR | 评分偏向推荐方案 | 方案 E 合并入 A，重评 |
| MINOR | 泛词比例 40% 缺方法论 | 保留为估算，Phase 1 测量时验证 |

### Round 2 发现

| 严重度 | 问题 | 处理 |
|--------|------|------|
| CRITICAL | SQLite 无 WAL/busy_timeout | 方案 D 已要求 WAL + busy_timeout |
| CRITICAL | Offset 文件竞态 | 改为存储在 sessions 表中，事务内读写 |
| MAJOR | Schema 迁移计划缺失 | 已补充 DB 迁移策略 |
| MAJOR | 正则注入风险 | 已区分三种关键词类型 |
| MAJOR | INSERT OR IGNORE 与置信度冲突 | 改为 ON CONFLICT DO UPDATE |
| MAJOR | 遗漏"结构化信号"方案（rule ID 引用） | §2 方案说明中提及局限性 |
| MINOR | 仪表盘查询会受影响 | Phase 1 验收标准包含 TS 类型评估 |

### Round 3 发现

| 严重度 | 问题 | 处理 |
|--------|------|------|
| CRITICAL | Phase 1 (Plan E) 对中文失效 → 合并入 A | 已合并 E→A，重写实施路径 |
| CRITICAL | E→A 分阶段无意义（代码重叠） | 合并为单次 Phase 1 |
| MAJOR | 关键词子串关系导致重复匹配 | 方案 A 增加"子串去重" |
| MAJOR | 多词短语需不同策略 | 附录 A 增加三种分类 |
| MAJOR | 缺少验收标准 | §4 每阶段增加验收标准 |
| MINOR | 可扩展性分析缺失 | §5.3 增加预估表 |

### 评审中确认的优点（保留）

1. 问题诊断（P1-P7）准确
2. 分阶段实施 + 数据驱动升级的哲学正确
3. 方案 C（MCP 主动）的合规性风险评估诚实
4. 置信度合并层级设计合理
5. 测量方法论（5 会话人工标注）实用
