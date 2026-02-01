# 模板一致性检查规范

本文档定义场景模板一致性验证的检查规则和执行方法。

---

## 检查目标

1. **步骤结构一致性**：验证新场景与模板场景的步骤结构一致
2. **变量引用检查**：验证 extract_vars 提取的变量被正确使用

---

## 输入文档

### scenarios.xlsx 结构

#### Sheet1: 场景信息

| 列 | 字段 | 说明 |
|----|------|------|
| A | scenario_id | 场景 ID |
| C | status | 状态（模板示例/待导入/待审查） |
| I | test_steps | 测试步骤描述 |

#### Sheet2: 步骤详情

| 列 | 字段 | 说明 |
|----|------|------|
| A | scenario_id | 关联场景 ID |
| B | step_order | 步骤顺序 |
| C | api_uuid | 接口 UUID |
| H | body | 请求体 |
| K | extract_vars | 变量提取配置 |

---

## 一、步骤结构一致性检查

### 检查方法

#### 1. 提取模板场景步骤

```python
template_scenarios = filter(sheet1, status="模板示例")
for scenario in template_scenarios:
    steps = get_steps(sheet2, scenario.id)
    template_structure = {
        "step_count": len(steps),
        "api_sequence": [step.api_uuid for step in steps],
        "body_fields": [extract_fields(step.body) for step in steps]
    }
```

#### 2. 对比新场景结构

检查点：

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| 步骤数量不一致 | 新场景步骤数与模板不同 | WARNING |
| 接口顺序不一致 | API 调用顺序与模板不同 | WARNING |
| body 结构差异 | 请求体字段结构与模板不同 | INFO |

### 步骤数量判断

根据 test_steps 描述智能判断预期步骤数：

```python
def expected_step_count(test_steps):
    # 关键词计数
    if "1个接口" in test_steps or "单步" in test_steps:
        return 1
    if "2个接口" in test_steps or "两步" in test_steps:
        return 2
    if "完整流程" in test_steps or "全部步骤" in test_steps:
        return "full"  # 使用模板完整步骤数
    # 默认：根据提到的动作数推断
    actions = count_actions(test_steps)
    return actions
```

### 输出格式

```
├── 步骤结构:
│   ├── 场景数: 5 个
│   ├── 结构一致: 4 个
│   └── 结构偏离: 1 个
│       └── 场景 #3: 步骤数 2 个，模板 4 个（可能是测试简化场景）
```

---

## 二、变量引用检查

### 变量提取配置

extract_vars 用于从响应中提取变量供后续步骤使用：

```json
[
  {"variable": "orderId", "expression": "$.data.orderId", "type": "JSONPath"},
  {"variable": "token", "expression": "$.data.token", "type": "JSONPath"}
]
```

### 变量引用位置

提取的变量可能在后续步骤中使用：

1. **body 中引用**：`${orderId}`
2. **headers 中引用**：`${token}`
3. **pre_script/post_script 中引用**：`vars.get("orderId")`

### 检查规则

#### 1. 提取所有变量

```python
all_vars = {}
for step in steps:
    if step.extract_vars:
        vars_config = json.loads(step.extract_vars)
        for var in vars_config:
            all_vars[var["variable"]] = {
                "defined_at": step.step_order,
                "used_at": []
            }
```

#### 2. 检查变量使用

```python
for step in steps:
    # 检查 body 中的变量引用
    body_vars = find_vars_in_text(step.body)  # 查找 ${xxx} 模式
    for var in body_vars:
        if var in all_vars:
            all_vars[var]["used_at"].append(step.step_order)
        else:
            warnings.append("步骤 {} 引用未定义变量 {}".format(
                step.step_order, var))

    # 检查 headers、scripts 中的变量引用
    # ...
```

#### 3. 识别问题

| 问题类型 | 说明 | 严重程度 |
|----------|------|----------|
| 变量未使用 | 提取了变量但从未引用 | WARNING |
| 引用未定义变量 | 使用了未提取的变量 | WARNING |
| 引用顺序错误 | 在变量定义之前就引用 | ERROR |

### 输出格式

#### 通过

```
├── 变量引用:
│   ├── 提取变量: 5 个
│   ├── 引用正确: 5 个
│   └── 引用错误: 0 个
```

#### 有问题

```
├── 变量引用:
│   ├── 提取变量: 5 个
│   ├── 引用正确: 3 个
│   └── 引用错误: 2 个
│       ├── 场景 #2: 变量 orderId 未被使用
│       └── 场景 #3 步骤 2: 引用未定义变量 userId
```

---

## 三、综合判定规则

| 步骤结构 | 变量引用 | 最终状态 |
|----------|----------|----------|
| 存在偏离 | 存在错误 | ⚠️ 警告（WARNING 级别） |
| 存在偏离 | 全部正确 | ⚠️ 警告（WARNING 级别） |
| 全部一致 | 存在错误 | ⚠️ 警告（WARNING 级别） |
| 全部一致 | 全部正确 | ✅ 通过 |

> 注：变量引用顺序错误是 ERROR 级别，其他变量问题是 WARNING 级别

---

## 四、特殊情况处理

### 没有模板场景

如果没有 status=模板示例 的场景：
- 跳过步骤结构一致性检查
- 在 INFO 中提示"无模板场景可参考"

### 故意的结构差异

某些测试场景需要故意简化步骤：
- 只测试流程的一部分
- 跳过某些步骤

检查时应结合 test_steps 判断：
```
如果 test_steps 包含 "只测试第一步" 或 "简化流程"
→ 视为合理，不报警告
```

### 变量未使用但有意保留

某些变量可能是为了调试或后续扩展预留：
- 记录为 INFO 级别而非 WARNING
- 提示"变量 xxx 未使用，可考虑移除"
