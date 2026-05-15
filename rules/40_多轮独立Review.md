---
id: independent-review
title: 多轮独立 Review
order: 40
tags: [review, quality]
rules:
  - id: independent-review.separate-pass
    title: verification 和 code-review 分两个 pass
    keywords: ["verification", "code-review", "独立review", "两个pass"]
  - id: independent-review.reviewer-isolation
    title: reviewer 不共享主对话上下文
    keywords: ["独立", "不共享上下文", "只接收待审阅内容"]
  - id: independent-review.concurrent-limit
    title: 同时运行 reviewer 不超过 2 个
    keywords: ["reviewer", "同时运行", "并发review"]
---

## 多轮独立 Review

设计文档和重大代码变更必须经过独立 review。独立是指：reviewer 不共享主对话上下文，
只接收待审阅内容。按固定维度检查：事实准确性、逻辑完整性、安全性、性能、可维护性、
兼容性。后一轮在前一轮修复基础上 review，确保修复不引入新问题。
同时运行的 reviewer 不超过 2 个。
