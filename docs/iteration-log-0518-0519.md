# CLAUDE.md Manager 迭代记录：2026-05-18 ~ 2026-05-19

> 统计：共 **106 个 commit**（0518: 51 个，0519: 52 个，跨日 3 个）
> 范围：`4f0041c` → `2f8c0c2`

---

## 一、新功能（Feature）

### 1. History 版本对比与回滚
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 13:15 | `4f0041c` | 核心提交：History diff/rollback、rules search/filter、analytics time range、测试覆盖 |
| 05-18 15:18 | `0b1b696` | 提取 diff 算法为独立模块，新增 11 个前端单元测试 |
| 05-19 00:04 | `b4302a9` | 修复 init-history.py 使用 parse_all_rules() |

**功能影响**：仪表盘新增"版本历史"页，可选中两个快照查看 diff 并一键回滚。这是两天的最大功能增量。

### 2. Toast 通知系统 & Siblings API
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 14:50 | `fa9be72` | Toast 通知组件、siblings（同级规则）API、DB 合并 |

**功能影响**：所有 CRUD 操作现在有 toast 反馈；规则详情页可查看同 section 下的其他规则。

### 3. Error Boundary、全局 Loading、自定义 404
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 15:44 | `6b12feb` | Error Boundary 包裹全局、全局 loading spinner、自定义 404 页 |

**功能影响**：前端容错能力提升，渲染错误不再白屏；加载状态统一。

### 4. Cmd+K 快捷搜索
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 16:40 | `d009504` | Rules 页 Cmd+K 聚焦搜索框 |

**功能影响**：键盘用户可快速跳转搜索，与主流应用体验一致。

---

## 二、Bug 修复（Fix）

### 编辑器（Editor）
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 18:51 | `b8ecd61` | 所有操作添加 error handling + toast 反馈 |
| 05-19 02:24 | `24d61d9` | rules refresh 返回 error 时页面崩溃 |
| 05-19 02:48 | `c444080` | 规则拖拽重排序时丢失未保存编辑 |
| 05-19 04:20 | `160c31a` | publishDrafts 只计数实际写入的规则 |
| 05-19 07:18 | `e73e393` | 仅发布排序变更的草稿时保留磁盘内容 |
| 05-19 01:03 | `07c58e4` | 发布对话框点击背景可关闭 |

### 数据库 / API
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-19 01:26 | `7ed6d03` | rule detail API 带 days filter 时崩溃（缺表别名） |
| 05-19 02:12 | `12bbfe1` | cold_rules 查询 days_since_last_citation 始终返回 NULL |
| 05-19 02:10 | `e21cab2` | 无效 rule ID 返回 500 改为 400 |
| 05-19 02:18 | `4427208` | 500 响应泄漏内部错误信息 |
| 05-19 07:39 | `823c98c` | （同上）移除 500 响应中的内部细节 |
| 05-19 06:48 | `b71d2d0` | section session 计数多算 |
| 05-18 21:19 | `af8f7e6` | sections stats 未应用时间范围过滤 |
| 05-18 20:41 | `e916549` | SQL days filter 硬编码 locale |

### History / 构建系统
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-19 00:14 | `bb43208` | history 页面组件卸载时清理 timeout |
| 05-19 00:44 | `f18a362` | sanitizeRuleId 不允许点号，规则详情页崩溃 |
| 05-19 06:17 | `b82c245` | formatTs 中的正则替换无效 |
| 05-19 09:38 | `8587030` | CLAUDE.md 未变时仍生成孤儿快照 |

### i18n
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 18:53 | `62bef7a` | 全局 error 和 404 页翻译为中文 |
| 05-18 22:27 | `9263198` | 所有硬编码中文字符串替换为 i18n key |
| 05-19 02:44 | `6fa24ef` | 404 / global error / html lang 属性响应语言切换 |

### 类型 / 编译
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-19 03:07 | `6ce9d49` | ValidationError 接口名遮蔽 + assemble 中 git add 范围 |
| 05-19 04:24 | `f5fa1df` | RuleWithStats 类型与 API 响应对齐，修复 tsc 错误 |
| 05-19 10:02 | `f1231be` | 测试文件 TypeScript strict mode 错误 |

### 其他
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 14:00 | `d510fad` | analytics 趋势图未响应时间范围选择 |
| 05-18 13:40 | `e7b4554` | section filter 改为 dropdown |
| 05-18 15:22 | `48222c7` | section filter dropdown 与 URL 参数同步 |
| 05-18 16:36 | `dddd80a` | history 页 timer 清理、移除 any 类型 |
| 05-19 01:05 | `f1ca6a5` | 添加 @tailwindcss/typography，Markdown 预览样式生效 |

---

## 三、安全加固（Security）

| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 18:27 | `f3d69c0` | 全量 API 路由输入校验 |
| 05-18 18:28 | `31903d3` | history diff API 文件名参数校验，防路径遍历 |
| 05-18 15:21 | `216028a` | reorder 和 draft endpoint 输入校验 |
| 05-18 21:01 | `2363957` | citations API rule_id 校验 |

**功能影响**：所有 API 端点完成输入校验，防止 SQL 注入和路径遍历。

---

## 四、性能优化（Performance）

### 数据库层
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 17:00 | `2c4d18f` | 3 个 analytics 查询合并为 1 条 SQL |
| 05-18 17:07 | `dc1bf68` | SQL 字符串拼接改为显式条件 |
| 05-18 20:59 | `392f690` | session 文件扫描限为最近 1 小时内修改的文件 |

### API 层（SQLite 连接池化）
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-19 04:49 | `e1f8cd3` | GET /api/rules: 3 连接合并为 1 |
| 05-19 04:53 | `564773e` | GET /api/analytics: 共享连接 |
| 05-19 05:11 | `04becc3` | rule detail endpoint: 共享连接 |
| 05-19 06:43 | `78491d7` | GET /api/citations: 共享连接 |

### 前端
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 15:47 | `bf4f3bf` | Recharts MiniSparkline 替换为纯 SVG |
| 05-18 18:49 | `9a885fe` | tooltipStyle hook 提取 + StatCard memo 化 |
| 05-18 19:13 | `7d7cad3` | 规则文件从解析 3 次改为 1 次 |
| 05-18 19:32 | `69a4e21` | editor 组件 memo 化 |

**功能影响**：仪表盘 API 响应更快（减少 DB 连接开销），规则列表渲染更流畅。

---

## 五、可访问性（Accessibility）

| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 21:00 | `e13c5de` | publish dialog 添加 Escape 关闭 + focus 管理 |
| 05-18 22:54 | `86f3b7a` | 图标按钮添加 aria-label |
| 05-19 01:46 | `a268fd9` | 语言切换时更新 html lang 属性 |
| 05-19 04:46 | `7dddde4` | editor 组件添加键盘导航 + ARIA labels |

---

## 六、重构（Refactor）

| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 14:27 | `6e66f21` | API 提取 getTotalSessionCount helper |
| 05-18 15:51 | `323753b` | 提取 fetchJson helper，5 页 fetch 样板代码替换 |
| 05-18 17:18 | `a23f81e` | 提取共享图表颜色 + error toast |
| 05-18 17:25 | `cd1c127` | 提取 useFetch hook，替换 5 页 fetch 样板 |
| 05-19 05:49 | `a9b27c3` | 共享类型合并到 lib/types.ts |
| 05-19 06:20 | `3ad6dc8` | RuleWithStats / SectionWithStats 跨页去重 |
| 05-19 06:21 | `ea2ca49` | history 页从 lib/snapshots 导入类型 |
| 05-19 08:45 | `b5843d9` | 移除死代码 get_rule_stats |

---

## 七、测试覆盖（Test）

### Python 后端
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 21:46 | `3e50a79` | snapshots、editor-db、db.py 边界测试 |
| 05-18 21:21 | `68a5be9` | find_latest_session mtime 优化测试 |
| 05-18 23:19 | `7391a3b` | session-logger main() + 边界测试 |
| 05-18 23:39 | `4e2f20d` | assemble.py CLI、校验、git commit 测试 |
| 05-19 06:43 | `8f488c8` | git_commit_if_changed 测试（99% 覆盖） |
| 05-19 10:33 | `2f8c0c2` | Python 边界用例补充 |

### TypeScript 前端
| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 16:12 | `e515497` | fetchJson 单元测试 |
| 05-18 15:18 | `0b1b696` | diff 算法 11 个单元测试 |
| 05-19 03:51 | `f36a208` | editor-db CRUD 测试（63→72 tests, 56%→84%） |
| 05-19 04:09 | `8e5bdc3` | publishDrafts + api-handler（72→80 tests, 99% stmt） |
| 05-19 06:10 | `fdafaa9` | editor-db frontmatter 解析分支覆盖 |
| 05-19 07:41 | `e2941ef` | editor-db sort-by-order + assemble fallback |
| 05-19 07:09 | `0041730` | api-utils 边界测试 |
| 05-19 08:04 | `2ef171e` | diff fallback 覆盖 |
| 05-19 08:47 | `a3ae4f5` | db.ts days filter 覆盖 |
| 05-19 09:14 | `8ebf1a1` | useFetch hook 测试（jsdom） |

---

## 八、清理与杂项（Chore / Cleanup）

| 时间 | Commit | 说明 |
|------|--------|------|
| 05-18 13:19 | `58ae434` | 移除死代码（旧 rollback stub、未用 DB 函数） |
| 05-18 14:52 | `5de52bd` | 移除未用 next-themes 依赖 |
| 05-18 16:16 | `3b6c3ab` | untrack log 文件 |
| 05-18 21:40 | `09406de` | 移除 Next.js 占位 SVG |
| 05-18 21:22 | `ec520ba` | shadcn CLI 移到 devDependencies |
| 05-18 23:13 | `069fe47` | Turbopack root 警告修复 + 未用 CSS 变量清理 |
| 05-18 20:19 | `06ea048` | ESLint 错误/警告 21→0 |
| 05-19 00:37 | `6a58ffd` | 移除 25 个未用 i18n key |
| 05-19 03:29 | `946910d` | 移除 4 个未用 i18n key |
| 05-19 07:13 | `3787a3f` | ESLint no-explicit-any 警告修复 |
| 05-19 09:16 | `e062cd6` | .coverage 和 package-lock.json 加入 gitignore |
| 05-19 10:04 | `6c7cdd8` | editor-db 测试中移除未用 helper |

---

## 九、功能层面关键变化总结

### 用户可感知的功能变化

1. **版本历史页（History）**：全新页面，支持快照选择 → diff 对比 → 一键回滚
2. **规则搜索/过滤**：Rules 页支持关键词搜索 + section 下拉过滤 + Cmd+K 快捷键
3. **Analytics 时间范围**：趋势图和统计支持按时间范围筛选
4. **Toast 通知**：所有 CRUD 操作有即时反馈
5. **Error Boundary**：渲染异常不再白屏
6. **Markdown 预览**：添加 typography 插件后渲染正确
7. **规则拖拽重排序**：支持拖拽且不丢失未保存内容

### 不直接可感知但重要的变化

- **安全**：全量 API 输入校验，防路径遍历和 SQL 注入
- **性能**：SQLite 连接池化（4 个端点）、session 扫描限流、前端 memo 化
- **可访问性**：键盘导航、ARIA labels、focus 管理
- **国际化**：硬编码中文全部替换为 i18n key
- **测试覆盖**：从少量测试提升到 Python 96%+ / TS 97%+ 覆盖率
