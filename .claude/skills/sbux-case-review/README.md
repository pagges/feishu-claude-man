# /sbux:case-review 使用指南

> 审查用例代码，验证与需求的一致性、模板符合度和逻辑正确性

## 工作流定位

```
QA 用例流程：
  /sbux:case-proposal → /sbux:case-apply → [/sbux:case-review] → /sbux:case-import → /sbux:case-run
                                                  ↑                                         ↓
                                              当前位置                        /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:case-apply 编写的用例代码 | **/sbux:case-review** | 通过 → /sbux:case-import |
| | | 不通过 → 修复后重新审查 |

---

## 快速开始

### 前置条件

- `/sbux:case-apply` 已完成
- cases.xlsx 中有 status=待导入 的用例

### 基本用法

```bash
/sbux:case-review /path/to/cases
```

---

## 最佳实践

1. **关注需求覆盖率** - 确保所有功能点都有对应用例

2. **检查断言合理性** - 断言是否足够验证业务规则

3. **验证逻辑正确性** - test_summary 描述与代码实现是否匹配

4. **问题修复后重新审查** - 确保所有问题都已解决

---

## 审查维度

| 维度 | 检查内容 | 规范文件 |
|------|---------|---------|
| 需求一致性 | 覆盖率、字段完整性 | REQUIREMENTS-CHECK.md |
| 模板一致性 | 结构、断言合理性 | TEMPLATE-CHECK.md |
| 逻辑正确性 | test_summary vs 代码 | LOGIC-CHECK.md |

---

## 输出产物

| 产物 | 位置 | 用途 |
|------|------|------|
| 审查报告 | `{folder}/case-review-report.md` | 问题清单和建议 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 覆盖率不足 | 补充缺失的用例 |
| 断言不合理 | 参考模板用例调整 |
| 逻辑错误 | 修正代码实现 |

---

## 下一步

审查完成后：

- **通过** → `/sbux:case-import` 导入用例
- **不通过** → 修复问题后重新 `/sbux:case-review`
