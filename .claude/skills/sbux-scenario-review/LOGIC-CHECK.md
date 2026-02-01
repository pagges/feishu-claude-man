# 逻辑正确性检查规范

本文档定义场景逻辑正确性验证的检查规则和执行方法。

---

## 检查目标

1. **test_steps 与步骤数量对应**：验证描述的步骤数与实际步骤数一致
2. **expected 与断言对应**：验证预期结果与断言配置一致

---

## 输入文档

### scenarios.xlsx 结构

#### Sheet1: 场景信息

| 列 | 字段 | 说明 |
|----|------|------|
| A | scenario_id | 场景 ID |
| I | test_steps | 测试步骤描述 |
| J | expected | 预期结果 |

#### Sheet2: 步骤详情

| 列 | 字段 | 说明 |
|----|------|------|
| A | scenario_id | 关联场景 ID |
| B | step_order | 步骤顺序 |
| D | step_name | 步骤名称 |
| J | assertions | 断言配置 |

---

## 一、test_steps 与步骤数量对应

### 解析 test_steps

从 test_steps 描述中提取预期步骤信息：

#### 数量提取规则

| 描述模式 | 预期步骤数 |
|----------|------------|
| "1个接口"、"单步" | 1 |
| "2个接口"、"两步" | 2 |
| "3个步骤"、"三步" | 3 |
| "完整流程" | 与模板相同 |
| 列举多个动作（用序号或分号分隔） | 动作数量 |

#### 步骤描述解析

```python
def parse_step_count(test_steps):
    # 显式数字
    match = re.search(r'(\d+)\s*(个|步)', test_steps)
    if match:
        return int(match.group(1))

    # 中文数字
    chinese_nums = {"一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5}
    for cn, num in chinese_nums.items():
        if cn + "步" in test_steps or cn + "个" in test_steps:
            return num

    # 序号列举：1. xxx 2. xxx
    numbered = re.findall(r'^\d+\.', test_steps, re.MULTILINE)
    if numbered:
        return len(numbered)

    # 分号分隔的动作
    if "；" in test_steps:
        return len(test_steps.split("；"))

    return None  # 无法确定
```

### 验证逻辑

```python
def check_step_count(scenario, steps):
    expected = parse_step_count(scenario.test_steps)
    actual = len(steps)

    if expected is None:
        return INFO("无法从 test_steps 确定预期步骤数")

    if expected != actual:
        return ERROR(
            "test_steps 描述 {} 步，实际 {} 步".format(expected, actual))

    return PASS
```

### 输出格式

```
├── 步骤数量:
│   ├── 已检查场景: 5 个
│   ├── 数量一致: 4 个
│   ├── 数量不一致: 1 个
│   │   └── 场景 #3: test_steps 描述 3 步，实际 2 步
│   └── 无法确定: 0 个
```

---

## 二、expected 与断言对应

### 解析 expected

从 expected 列提取预期结果信息：

#### 关键词识别

| expected 描述 | 预期断言类型 |
|---------------|--------------|
| 成功、返回成功 | statusCode = 成功码 |
| 失败、返回错误 | statusCode = 错误码 |
| 返回订单号 | 响应包含订单号字段 |
| 状态变为 xxx | 状态字段 = xxx |

#### 解析规则

```python
def parse_expected(expected):
    results = []

    # 状态码预期
    if "成功" in expected:
        results.append({"type": "statusCode", "expect": "success"})
    elif "失败" in expected or "错误" in expected:
        results.append({"type": "statusCode", "expect": "error"})

    # 字段存在预期
    field_match = re.search(r'返回(.+?)号', expected)
    if field_match:
        results.append({
            "type": "field_exists",
            "field": field_match.group(1) + "号"
        })

    # 状态变更预期
    status_match = re.search(r'状态(?:变为|变成|更新为)(.+)', expected)
    if status_match:
        results.append({
            "type": "status_change",
            "status": status_match.group(1)
        })

    return results
```

### 验证断言

检查各步骤的 assertions 是否体现 expected 中的预期：

```python
def check_assertions_match_expected(expected_items, steps):
    issues = []

    for item in expected_items:
        found = False

        if item["type"] == "statusCode":
            # 检查最后一步是否有 statusCode 断言
            last_step = steps[-1]
            assertions = json.loads(last_step.assertions)
            for a in assertions:
                if "statusCode" in a.get("expression", ""):
                    if item["expect"] == "success":
                        if is_success_code(a["expect"]):
                            found = True
                    else:
                        if not is_success_code(a["expect"]):
                            found = True

        elif item["type"] == "field_exists":
            # 检查是否有对应字段的断言
            for step in steps:
                assertions = json.loads(step.assertions)
                for a in assertions:
                    if item["field"] in a.get("expression", ""):
                        found = True

        if not found:
            issues.append("expected 中 '{}' 未在断言中体现".format(
                item.get("field") or item.get("status") or item["expect"]))

    return issues
```

### 输出格式

#### 通过

```
├── 断言匹配:
│   ├── 已检查场景: 5 个
│   ├── 断言匹配: 5 个
│   └── 断言不匹配: 0 个
```

#### 有问题

```
├── 断言匹配:
│   ├── 已检查场景: 5 个
│   ├── 断言匹配: 3 个
│   └── 断言不匹配: 2 个
│       ├── 场景 #2: expected "返回订单号" 未在断言中体现
│       └── 场景 #4: expected "失败" 但最后步骤断言 statusCode=100
```

---

## 三、综合判定规则

| 步骤数量 | 断言匹配 | 最终状态 |
|----------|----------|----------|
| 不一致 | 不匹配 | ❌ 失败（ERROR 级别） |
| 不一致 | 匹配 | ❌ 失败（ERROR 级别） |
| 一致 | 不匹配 | ⚠️ 警告（WARNING 级别） |
| 一致 | 匹配 | ✅ 通过 |

---

## 四、问题分级

| 问题类型 | 级别 | 说明 |
|----------|------|------|
| 步骤数量不一致 | ERROR | test_steps 与实际步骤数不符 |
| 断言与 expected 矛盾 | ERROR | expected 说失败但断言成功码 |
| 断言未体现 expected | WARNING | expected 的部分内容未在断言中验证 |
| 无法解析 expected | INFO | expected 描述不够明确 |

---

## 五、特殊情况

### expected 描述模糊

某些 expected 可能描述不够具体：

```
"流程正常完成"  // 没有具体验证点
"符合预期"       // 太过笼统
```

处理方式：
1. 标记为 INFO 级别
2. 提示"建议明确 expected 描述"

### 多步骤场景的 expected

对于多步骤场景，expected 可能描述最终结果而非每步结果：

```
expected: "订单创建成功，支付完成，状态变为已支付"
```

处理方式：
1. 将 expected 拆分为多个验证点
2. 在最后一步或相关步骤中查找对应断言

### 步骤数量故意不同

某些场景可能需要比模板更少的步骤：

```
test_steps: "只执行第一步，验证单步结果"
```

处理方式：
1. 结合 test_steps 关键词判断
2. 如果是有意简化，降低问题级别
