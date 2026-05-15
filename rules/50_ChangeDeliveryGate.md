---
id: change-delivery-gate
title: Change Delivery Gate
order: 50
tags: [delivery, quality, gate]
rules:
  - id: change-delivery-gate.verified
    title: 已完成相关验证并报告
    keywords: ["验证", "报告结果"]
  - id: change-delivery-gate.quality-gate
    title: 已过对应质量门禁
    keywords: ["质量门禁", "review", "verification"]
  - id: change-delivery-gate.cant-verify
    title: 关键验证无法执行时说明原因
    keywords: ["无法验证", "说明原因"]
  - id: change-delivery-gate.no-fabrication
    title: 禁止虚构命令输出
    keywords: ["虚构", "命令输出", "造假"]
  - id: change-delivery-gate.no-claim-without-evidence
    title: 没有验证证据不得声称完成
    keywords: ["声称完成", "验证证据", "通过"]
  - id: change-delivery-gate.coverage-report
    title: 重大需求迭代附带覆盖率统计
    keywords: ["覆盖率统计", "重大需求", "迭代"]
---

## Change Delivery Gate

声明完成、准备 commit / push / PR 之前必须满足：

1. 已完成相关验证，并如实报告结果
2. 已过对应质量门禁（review / verification）
3. 关键验证无法执行时必须明确说明原因
4. 禁止虚构命令输出
5. 没有验证证据，不得声称"通过" / "完成"
6. 重大需求迭代必须附带最新覆盖率统计数据
