---
id: tdd-coverage
title: TDD 与覆盖率标准
order: 45
tags: [tdd, coverage, testing]
rules:
  - id: tdd-coverage.baseline
    title: 覆盖率有底线
    keywords: ["覆盖率目标", "覆盖率底线", "CLAUDE.md声明", "coverage target"]
  - id: tdd-coverage.per-iteration
    title: 迭代交付包含覆盖率数据
    keywords: ["覆盖率数据", "交付报告", "覆盖率统计"]
  - id: tdd-coverage.decline-blocks
    title: 覆盖率下降即阻塞
    keywords: ["覆盖率下降", "阻塞", "补测试"]
  - id: tdd-coverage.quality-over-quantity
    title: 测试质量 > 测试数量
    keywords: ["测试质量", "正常路径", "错误路径", "边界条件"]
---

## TDD 与覆盖率标准

只要求"先写测试"不是 TDD，没有量化覆盖率目标的 TDD 是空谈。每次迭代必须做到：

1. **覆盖率有底线**：项目 CLAUDE.md 中必须声明各层覆盖率目标
   （如 Models ≥ 90%、Services ≥ 80%、API ≥ 70%），不声明目标等于没有标准。
2. **迭代交付包含覆盖率数据**：每次重大需求迭代完成后，必须重新运行覆盖率
   统计，将结果作为交付报告的一部分呈现给用户。没有覆盖率数据不算完成。
3. **覆盖率下降即阻塞**：新代码导致覆盖率低于目标线时，必须先补测试再继续
   开发功能，不得以"后续补"为由跳过。
4. **测试质量 > 测试数量**：覆盖正常路径 + 错误路径 + 边界条件。仅测 happy path
   的测试即使覆盖率数字达标，仍需补充异常和边界用例。

核心立场：没有覆盖率标准的 spec coding 和 TDD 是形式主义的空壳。标准必须具体、
可度量、可验证，且每次交付都带着数据说话。
