# /sbux:case-apply 使用指南

> 基于用例需求 Excel 编写具体的测试代码

## 工作流定位

```
QA 用例流程：
  /sbux:case-proposal → [/sbux:case-apply] → /sbux:case-review → /sbux:case-import → /sbux:case-run
                              ↑                                                            ↓
                          当前位置                                        /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:case-proposal 生成的 cases.xlsx | **/sbux:case-apply** | /sbux:case-review（推荐） |
| | | /sbux:case-import（跳过审查） |

---

## 快速开始

### 前置条件

- `/sbux:case-proposal` 已完成
- cases.xlsx 中有 status=待实现 的用例

### 基本用法

```bash
/sbux:case-apply /path/to/cases
```

指定包含 cases.xlsx 的目录。

---

## 最佳实践

1. **基于模板用例扩展** - 参考模板用例的代码结构，保持一致性

2. **保持结构一致** - 请求参数、断言方式与模板保持统一风格

3. **断言要完整** - 验证响应状态码、关键字段、业务规则

4. **先审查再导入** - 建议执行 /sbux:case-review 确保代码质量

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| cases.xlsx | /sbux:case-proposal | 包含待实现用例 |
| 模板用例代码 | Excel 中 status=模板示例 | 参考结构 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 更新的 Excel | `{folder}/cases.xlsx` | M-U 列填充代码 |

---

## 代码列说明

| 列 | 内容 |
|-----|------|
| M | request_method |
| N | request_url |
| O | request_headers |
| P | request_params |
| Q | request_body |
| R | expected_status |
| S | assertions |
| T | pre_script |
| U | post_script |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 生成的代码不符合预期 | 检查 test_summary 是否描述清晰 |
| 与模板结构差异大 | 参考模板用例调整 |
| 断言不够完整 | 手动补充关键断言 |

---

## 下一步

用例代码编写后：

- 审查用例 → `/sbux:case-review`（推荐）
- 直接导入 → `/sbux:case-import`
