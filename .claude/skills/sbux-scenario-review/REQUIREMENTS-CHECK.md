# 需求一致性检查规范

本文档定义场景需求一致性验证的检查规则和执行方法。

---

## 检查目标

1. **流程覆盖检查**：验证需求文档中的业务流程都有对应的场景覆盖
2. **步骤完整性检查**：验证场景的步骤详情完整且格式正确

---

## 输入文档

### 需求文档

读取输入文件夹中的所有 `*.md` 文件，提取业务流程：
- 产品需求文档中的用户操作流程
- 测试需求文档中的测试场景要求
- 接口文档中的接口调用顺序

### scenarios.xlsx 结构

#### Sheet1: 场景信息

| 列 | 字段 | 说明 |
|----|------|------|
| A | scenario_id | 场景 ID |
| B | name | 场景名称 |
| C | status | 状态（模板示例/待导入/待审查） |
| I | test_steps | 测试步骤描述 |
| J | expected | 预期结果 |

#### Sheet2: 步骤详情

| 列 | 字段 | 类型 | 必填 | 说明 |
|----|------|------|------|------|
| A | scenario_id | String | 是 | 关联场景 ID |
| B | step_order | Number | 是 | 步骤顺序 |
| C | api_uuid | String | 是 | 接口 UUID |
| D | step_name | String | 是 | 步骤名称 |
| E | method | String | 是 | HTTP 方法 |
| F | path | String | 是 | 接口路径 |
| G | headers | JSON | 否 | 请求头 |
| H | body | JSON | 否 | 请求体 |
| I | body_type | String | 否 | body 类型 |
| J | assertions | JSON | 是 | 断言配置 |
| K | extract_vars | JSON | 否 | 变量提取 |
| L | pre_script | String | 否 | 前置脚本 |
| M | post_script | String | 否 | 后置脚本 |

---

## 一、流程覆盖检查

### 提取业务流程

从需求文档中识别需要测试的业务流程：

#### 关键词识别

| 关键词 | 流程类型 |
|--------|----------|
| 流程、步骤、顺序 | 多步骤操作流程 |
| 先...再...然后 | 顺序操作流程 |
| 登录→创建→提交 | 链式操作流程 |
| 完整流程、端到端 | E2E 测试流程 |

#### 提取规则

1. 识别涉及多个接口调用的业务场景
2. 识别有先后顺序要求的操作
3. 识别需要数据传递的接口链

### 构建追溯矩阵

```
{
  "用户注册→登录流程": ["场景#1: 新用户注册并登录"],
  "下单→支付→发货流程": ["场景#2: 完整购物流程"],
  "退款流程": []  // 未覆盖
}
```

### 覆盖率计算

```
覆盖率 = (有场景覆盖的流程数量 / 总业务流程数量) × 100%
```

### 判定标准

| 覆盖率 | 状态 |
|--------|------|
| 100% | ✅ 通过 |
| 80% - 99% | ⚠️ 警告（INFO 级别） |
| < 80% | ⚠️ 警告（INFO 级别） |

> 注：流程未覆盖仅作为 INFO 级别提示，不影响审查结果

---

## 二、步骤完整性检查

### 步骤存在性验证

对于 Sheet1 中每个待审查的场景，检查 Sheet2 中是否存在对应步骤：

```python
for scenario in pending_scenarios:
    steps = get_steps_by_scenario_id(sheet2, scenario.id)
    if len(steps) == 0:
        return ERROR("场景 {} 无步骤详情".format(scenario.id))
```

### 必填字段验证

#### scenario_id (A列) - 必填

- 必须与 Sheet1 中的场景 ID 对应
- 不能为空

#### step_order (B列) - 必填

- 必须是正整数
- 同一场景内步骤顺序应连续（1, 2, 3...）

#### api_uuid (C列) - 必填

- 必须存在且非空
- 应该是合法的 UUID 格式

#### assertions (J列) - 必填

- 必须存在且非空
- 必须是合法 JSON 数组格式
- 必须包含至少一个断言

**合法格式**：
```json
[{"expression": "$.statusCode", "expect": "100", "option": "EQUALS"}]
```

### JSON 格式验证

对于 JSON 类型字段（headers, body, assertions, extract_vars），验证：

```python
def validate_json_field(value, field_name):
    if value is None or value == "":
        return None  # 可选字段允许为空
    try:
        data = json.loads(value)
        if not isinstance(data, (list, dict)):
            return ERROR("{} 应为数组或对象类型".format(field_name))
        return None
    except json.JSONDecodeError as e:
        return ERROR("{} JSON 格式错误: {}".format(field_name, str(e)))
```

### 输出格式

#### 通过

```
├── 步骤完整:
│   ├── 已检查场景: 5 个
│   ├── 步骤完整: 5 个
│   └── 步骤缺失/格式错误: 0 个
```

#### 失败

```
├── 步骤完整:
│   ├── 已检查场景: 5 个
│   ├── 步骤完整: 3 个
│   └── 步骤缺失/格式错误: 2 个
│       ├── 场景 #2: Sheet2 无步骤详情
│       └── 场景 #4 步骤 2: assertions JSON 格式错误
```

---

## 三、综合判定规则

| 流程覆盖 | 步骤完整 | 最终状态 |
|----------|----------|----------|
| 任意 | 存在缺失/格式错误 | ❌ 失败（ERROR 级别） |
| < 100% | 全部完整 | ⚠️ 警告（INFO 级别） |
| 100% | 全部完整 | ✅ 通过 |

---

## 四、常见问题

### 需求文档中无明确流程

1. 根据接口依赖关系推断默认流程
2. 在 INFO 中提示需求文档流程描述不明确

### 步骤顺序不连续

某些场景可能故意跳过某些步骤：
- 记录为 WARNING
- 提示确认是否有意为之

### 场景无步骤但状态已更新

Sheet1 状态为"待导入"但 Sheet2 无对应步骤：
- 记录为 ERROR
- 这是必须修复的问题
