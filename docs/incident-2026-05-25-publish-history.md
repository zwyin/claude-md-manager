# 事故分析：规则发布成功但版本历史无记录

**日期**: 2026-05-25
**发现时间**: ~18:00
**影响时段**: 2026-05-19 ~ 2026-05-25（6 天）
**严重程度**: 中（数据完整性受损，但规则文件本身已正确更新）

## 1. 用户报告

> 下午17点左右更新了几条规则（PR 合并门禁），在规则编辑器已经看到了相应规则，但是版本历史当中没有本次改动的记录。

## 2. 现象还原

通过挖掘 Claude 会话 `cd68b3dc`（项目 `claude-session-watchdog`）的 JSONL 操作记录：

| 时间 | 行号 | 操作 | 结果 |
|------|------|------|------|
| 17:04:36 | L434 | MCP `save_draft` (pr-merge-gate) | 新增 CI 工作流 + PR 创建注意子规则 |
| 17:05:17 | L443-445 | MCP `delete_draft` × 3 | 清理旧的 reorder drafts |
| 17:05:33 | L456 | MCP `validate_drafts` | pr-merge-gate 校验通过 |
| 17:05:41 | L460 | MCP `publish_drafts` | 返回 `{"rules_changed":1,"snapshot_name":null,"error":null}` |
| 17:05:41 | L461 | PostToolUse hook | 成功执行 |
| 17:12:49 | L477 | MCP `get_publish_history` | **仅返回 row 9 (09:05)，无 17:05 的新记录** |
| 17:12:54 | L484 | Claude 回复 | 误判 row 9 为本次发布 |

**关键矛盾**：`publish_drafts` 返回 `error:null`（声称成功），但 `publish_history` 表中无对应记录。

## 3. 根因分析

### Bug 1（主因）：`assemble.py` 的 `git_commit_if_changed()` 永远不执行

**文件**: `build/assemble.py` L237, L243

`main()` 先写入 OUTPUT_PATH，再调用比较函数：

```python
# L237: 先写入
OUTPUT_PATH.write_text(content, encoding="utf-8")

# L243: 后比较 — 读到的就是刚写入的内容，永远相等
git_commit_if_changed(content)
```

`git_commit_if_changed` 内部：
```python
existing = OUTPUT_PATH.read_text()   # 读到刚写入的内容
if content == existing:              # 永远 True
    return                           # 永远跳过
```

**引入时间**: 2026-05-19 的 "snapshot optimization fix" (commit 未记录，observation 10283)

**后果**: 自5月19日起：
- assemble.py 从未创建 git commit
- 从未保存 snapshot 文件
- 规则文件变更从未被 git 追踪

### Bug 2：`git add data/history/` 被 gitignore 阻止

**文件**: `build/assemble.py` L172

```python
subprocess.run(["git", "add", "data/history/", "rules/"], ...)
```

`data/history/` 在 `.gitignore` 中被忽略，导致 `git add` 返回非零退出码，整个 commit 失败。

即使 Bug 1 被修复，commit 也会因此失败。

### Bug 3：Web `publishDrafts()` 不创建真实 snapshot

**文件**: `web/src/lib/editor-db.ts` L198-209

原代码：
```typescript
if (output.includes("Built CLAUDE.md")) {
  snapshotName = new Date().toISOString().replace(/[:.]/g, "-");
  // 仅赋值字符串，从不写入文件
}
```

只有 MCP 路径的 `_force_snapshot()` 会实际写文件到 `data/history/`。

### Bug 4：MCP `publish_all_drafts()` commit 未持久化

**文件**: `mcp_lib.py` L255-267

MCP 函数返回了 `{"rules_changed":1,"error":null}` 声称成功，但 `publish_history` INSERT 未提交到数据库。

**可能的深层原因**：

`get_db()` (hooks/db.py L82-91) 中调用了 `conn.executescript(SCHEMA_SQL)`。根据 Python sqlite3 文档，`executescript()` 会先执行隐式 COMMIT，可能影响后续事务的隐式管理行为：

```python
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.executescript(SCHEMA_SQL)    # 隐式 COMMIT + DDL
    _run_migrations(conn)
    return conn
```

在默认 `isolation_level=""` 下，Python sqlite3 自动管理事务。`executescript()` 后的连接状态可能不满足后续 `INSERT → commit` 的预期事务语义。由于此问题难以稳定复现，已添加显式事务控制 + commit 后验证作为防护。

### Bug 5：`better-sqlite3` 架构不匹配

**文件**: web 服务器 stderr.log

```
dlopen(...better_sqlite3.node): mach-o file, but is an incompatible architecture
(have 'x86_64', need 'arm64e' or 'arm64')
```

`better-sqlite3` 原生模块编译为 x86_64，但 launchd 服务使用 arm64 `/opt/homebrew/bin/npx`。导致 web 服务器所有数据库操作失败，web 编辑器不可用。

用户当时通过 MCP 路径（Python sqlite3）发布，不受此影响。

## 4. 修复内容

### Fix 1: `assemble.py` — 写入前保存旧内容

```python
# 写入前保存旧内容
old_content = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""

# 写入
OUTPUT_PATH.write_text(content, encoding="utf-8")

# 用旧内容做比较
git_commit_if_changed(content, old_content=old_content)
```

`git_commit_if_changed` 签名新增 `old_content` 参数，不再从磁盘读取。

### Fix 2: `assemble.py` — 移除 gitignored 路径

```python
# 修复前
subprocess.run(["git", "add", "data/history/", "rules/"], ...)

# 修复后
subprocess.run(["git", "add", "rules/"], ...)
```

Snapshot 文件为本地备份，不需要 git 追踪。

### Fix 3: `editor-db.ts` — 添加 `forceSnapshot()` 函数

新增 `forceSnapshot()` 函数，在写入规则文件前将当前 `~/.claude/CLAUDE.md` 备份到 `data/history/`。逻辑与 MCP 路径的 `_force_snapshot()` 一致。

### Fix 4: `mcp_lib.py` — 显式事务 + commit 验证

```python
db.execute("BEGIN IMMEDIATE")
cursor = db.execute("INSERT INTO publish_history ...", (...))
row_id = cursor.lastrowid

if not error_msg:
    db.execute("DELETE FROM rule_drafts")

db.commit()

# 验证 commit 持久化
verify = db.execute("SELECT id FROM publish_history WHERE id = ?", (row_id,)).fetchone()
if not verify:
    error_msg = error_msg or "publish_history commit verification failed"
```

`BEGIN IMMEDIATE` 确保在事务开始时就获取写锁，避免隐式事务管理的不确定性。commit 后立即验证行是否存在。

### Fix 5: `better-sqlite3` 重建

```bash
cd web && npm rebuild better-sqlite3
```

为 arm64 架构重新编译原生模块。

## 5. 验证结果

| 指标 | 值 |
|------|-----|
| Python 测试 | 183 passed |
| Web 测试 | 591 passed (48 files), 7 API 路由测试超时（预存问题） |
| `assemble.py` 手动运行 | 成功创建 snapshot + git commit |
| `better-sqlite3` 重建 | 成功 |

## 6. 受影响的数据

| 项目 | 影响 |
|------|------|
| `publish_history` | 5月19日-25日间的发布无记录（Bug 4） |
| `data/history/` snapshots | 5月19日后无新 snapshot（Bug 1） |
| Git commits | 5月19日后无 assemble.py 提交（Bug 1+2） |
| 规则文件 | 已正确更新，不受影响 |
| `~/.claude/CLAUDE.md` | 已正确重建，不受影响 |

## 7. 残留风险

1. **3 个 reorder drafts 仍存在**: `core-principles` (order=1), `explicit-assumptions` (order=2), `surgical-changes` (order=3)。这些是 reorder-only drafts（空内容），可能来自更早的会话操作。
2. **API 路由测试超时**: better-sqlite3 在 vitest forks worker 中的兼容性问题，与本次修复无关。
3. **Bug 4 的精确触发条件未确定**: 已添加防护（显式事务 + commit 验证），但无法稳定复现。
