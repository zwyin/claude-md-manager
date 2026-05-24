---
id: subagent-strategy
title: Subagent 策略
order: 20
tags: [subagent, parallel, concurrency]
rules:
  - id: subagent-strategy.must-dispatch
    title: 一定派子代理的场景
    keywords: ["并行", "parallel", "dispatch", "子代理"]
  - id: subagent-strategy.never-dispatch
    title: 一定不派的场景
    keywords: ["顺序依赖", "同一文件", "package.json", "单一目标", "sequential", "串行"]
---

## Subagent 策略

一定派子代理：

- 用户明说 "并行 / parallel / dispatch"
- 2-4 个边界清晰、独立验证、无共享状态的子任务
- 纯只读的多目标研究

一定不派：

- 任务有顺序依赖
- 多个子任务改同一文件 / contract / shared types
- package.json / lockfile / 根配置 / CI / schema / 总入口 默认串行
- 单一目标的 bug 修复
- 根因未明的调试
