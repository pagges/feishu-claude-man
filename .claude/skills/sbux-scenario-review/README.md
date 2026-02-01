# /sbux:scenario-review 使用指南

> 审查场景代码，验证与需求的一致性和逻辑正确性

## 工作流定位

```
QA 场景流程：
  /sbux:scenario-proposal → /sbux:scenario-apply → [/sbux:scenario-review] → /sbux:scenario-import → /sbux:scenario-run
                                                          ↑                                               ↓
                                                      当前位置                             /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:scenario-apply 编写的场景代码 | **/sbux:scenario-review** | 通过 → /sbux:scenario-import |
| | | 不通过 → 修复后重新审查 |

---

## 快速开始

### 前置条件

- `/sbux:scenario-apply` 已完成
- scenarios.xlsx 中有 status=待导入 的场景

### 基本用法

```bash
/sbux:scenario-review /path/to/scenarios
```

---

## 最佳实践

1. **检查流程覆盖率** - 确保端到端流程完整覆盖

2. **验证变量引用** - 步骤间的数据传递是否正确

3. **确保步骤数量与描述匹配** - test_steps 描述的步骤数应与实际一致

4. **同时检查 Sheet1 和 Sheet2** - 两个 Sheet 的数据要一致

---

## 审查维度

| 维度 | 检查内容 | 规范文件 |
|------|---------|---------|
| 需求一致性 | 流程覆盖、步骤完整 | REQUIREMENTS-CHECK.md |
| 模板一致性 | 结构、变量提取 | TEMPLATE-CHECK.md |
| 逻辑正确性 | test_steps vs 步骤详情 | LOGIC-CHECK.md |

---

## 输出产物

| 产物 | 位置 | 用途 |
|------|------|------|
| 审查报告 | `{folder}/scenario-review-report.md` | 问题清单和建议 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 流程覆盖不足 | 补充缺失的场景或步骤 |
| 变量引用错误 | 检查 extract 和 reference 配置 |
| 步骤数量不匹配 | 对齐 test_steps 描述和实际步骤 |

---

## 下一步

审查完成后：

- **通过** → `/sbux:scenario-import` 导入场景
- **不通过** → 修复问题后重新 `/sbux:scenario-review`
