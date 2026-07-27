---
id: global-claude-md-protection
title: 全局 CLAUDE.md 保护
order: 36
tags: [claude-md, governance, neat-freak]
rules:
  - id: global-claude-md-protection.draft-only
    title: 全局 ~/.claude/CLAUDE.md 修改必须走 claude-md-manager draft
    keywords: ["~/.claude/CLAUDE.md", "全局 CLAUDE.md", "draft", "claude-md-manager", "直接 Edit"]
  - id: global-claude-md-protection.neat-freak-scope
    title: neat-freak 同步范围限定项目级
    keywords: ["neat-freak", "/neat", "项目级 CLAUDE.md", "docs", "memory"]
---
## 全局 CLAUDE.md 保护

- `~/.claude/CLAUDE.md`（全局指令）的任何修改必须走 claude-md-manager 的 draft 系统：
  先 `save_draft` → `validate_drafts` → 用户明确确认 → `publish_drafts`。
  禁止任何 skill / agent / 子代理用 Edit 直接改这个文件。
- neat-freak（`/neat`）的同步范围限定在：项目根 `CLAUDE.md`/`AGENTS.md` + `docs/` + `README`
  + 项目内 agent memory。触及全局 `~/.claude/CLAUDE.md` 时必须停下来转 draft，不得直接编辑。
- 判定标准：diff 里如果出现对 `~/.claude/CLAUDE.md` 的直接 Edit，就是违规——
  不论是 neat-freak 还是其他 skill 触发的。