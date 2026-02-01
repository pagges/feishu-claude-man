# /sbux:scenario-apply 使用指南

> 基于模板场景克隆并修改参数，生成新场景的步骤详情

## 工作流定位

```
QA 场景流程：
  /sbux:scenario-proposal → [/sbux:scenario-apply] → /sbux:scenario-review → /sbux:scenario-import → /sbux:scenario-run
                                   ↑                                                                       ↓
                               当前位置                                                    /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:scenario-proposal 生成的 scenarios.xlsx | **/sbux:scenario-apply** | /sbux:scenario-review（推荐） |
| | | /sbux:scenario-import（跳过审查） |

---

## 快速开始

### 前置条件

- `/sbux:scenario-proposal` 已完成
- scenarios.xlsx 中有 status=待实现 的场景

### 基本用法

```bash
/sbux:scenario-apply /path/to/scenarios
```

---

## 最佳实践

1. **智能裁剪步骤** - 根据 test_steps 描述，合理增减步骤数量

2. **注意变量提取和引用** - 上一步的输出作为下一步的输入

3. **保持与模板结构一致** - 便于维护和理解

4. **先审查再导入** - 场景复杂度高，建议审查后再导入

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| scenarios.xlsx | /sbux:scenario-proposal | Sheet1 场景信息 |
| 模板场景步骤 | MeterSphere | 参考结构 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 更新的 Excel | `{folder}/scenarios.xlsx` | Sheet2 填充步骤详情 |

---

## Sheet2 结构

| 列 | 内容 |
|-----|------|
| scenario_name | 所属场景 |
| step_num | 步骤序号 |
| step_name | 步骤名称 |
| request_method | 请求方法 |
| request_url | 请求地址 |
| request_body | 请求体 |
| assertions | 断言 |
| extract | 变量提取 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 步骤数量不对 | 检查 test_steps 描述是否准确 |
| 变量引用错误 | 确保 extract 和 reference 配置正确 |
| 与模板差异大 | 参考模板场景结构调整 |

---

## 下一步

场景步骤编写后：

- 审查场景 → `/sbux:scenario-review`（推荐）
- 直接导入 → `/sbux:scenario-import`
