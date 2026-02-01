---
name: sbux:scenario-apply
description: QA 场景代码编写。基于模板场景克隆并修改参数，生成新场景的步骤详情。触发词：scenario-apply、场景实现、编写场景。
---

# QA 场景代码编写

## 参数

- `$ARGUMENTS`：输入文件夹路径（必填）

## Step 1: 读取输入

读取 `{input_folder}/scenarios.xlsx`：
- Sheet1: 筛选 `status = 待实现`（C 列）的场景作为待处理列表
- Sheet1: 筛选 `status = 模板示例` 的场景作为模板参考
- Sheet2: 获取模板场景的完整步骤参数

如果没有待实现的场景，提示用户并退出。

## Step 2: 读取需求文档

读取输入文件夹中的需求文档，理解测试场景和业务规则：
- 产品需求文档
- 测试需求文档
- 接口文档

## Step 3: 生成步骤详情

对于每个待实现的场景，根据 **test_steps（I 列）** 和 **模板场景** 生成步骤详情。

**核心原则**：基于模板场景进行裁剪和参数修改，保持结构一致性。

### 3.1 智能判断步骤数量

根据 test_steps 描述分析需要哪些步骤：
- 只提到 1 个接口 → 保留 1 步
- 提到 2 个接口/操作 → 保留 2 步
- 提到完整流程 → 保留全部步骤

### 3.2 body (H列)

基于模板 body 结构，根据 test_steps 修改对应字段：
- 正常场景：使用有效值
- 参数缺失：删除字段
- 参数为空：设为 `""`
- 参数为 null：设为 `null`
- 边界值：设为边界值

### 3.3 assertions (J列)

基于模板断言格式，根据 expected（J 列）调整：
```json
[{"expression": "$.statusCode", "expect": "100", "option": "EQUALS"}]
```

option 类型：`EQUALS` / `CONTAINS` / `NOT_CONTAINS` / `REGEX`

### 3.4 extract_vars (K列)

变量提取配置，用于步骤间传递数据：
```json
[{"variable": "orderId", "expression": "$.data.orderId", "type": "JSONPath"}]
```

### 3.5 pre_script / post_script (L-M列)

基于模板脚本，根据测试场景调整动态数据生成和验证逻辑。

## Step 4: 更新 Excel

使用 openpyxl 更新 `{input_folder}/scenarios.xlsx`：
- Sheet2: 填充步骤详情（每个场景的每个步骤一行）
- Sheet1: 更新 status（C 列）为 `待导入`

## 完成

输出摘要：
- 处理场景数
- 更新的 Excel 文件路径

---

## Step 5: 询问下一步操作

**第一步**：使用 AskUserQuestion 询问用户执行方式：

**提示**：`场景代码编写完成，请选择下一步操作：`

| 选项 | 说明 |
|------|------|
| SubAgent 执行审查（推荐） | 启动独立 SubAgent 执行 /sbux:scenario-review |
| 当前会话执行审查 | 在当前会话执行审查 |
| 跳过审查直接导入 | 跳过审查，直接导入场景 |
| 不执行 | 结束流程，稍后手动操作 |

**第二步**：如果用户选择了「SubAgent 执行审查」，再使用 AskUserQuestion 询问执行模式：

| 选项 | 说明 |
|------|------|
| 同步等待（推荐） | 等待 SubAgent 完成后返回结果 |
| 异步执行 | 后台运行，当前会话可继续其他工作 |

**用户选择后的行为**：

1. **选择「SubAgent 执行审查」**：
   - 询问同步/异步后：
   - **同步**：Task(subagent_type: "general-purpose", prompt: "/sbux:scenario-review {input_folder}")
   - **异步**：Task(subagent_type: "general-purpose", run_in_background: true, prompt: "/sbux:scenario-review {input_folder}")

2. **选择「当前会话执行审查」**：Skill(sbux:scenario-review, args: "{input_folder}")

3. **选择「跳过审查直接导入」**：Skill(sbux:scenario-import, args: "{input_folder}")

4. **选择「不执行」**：结束并提示

**后续提示**：
1. 审核 `scenarios.xlsx` 中的步骤详情（Sheet2）
2. 可以修改 body、assertions、脚本等
3. 审查完成后运行 `/sbux:scenario-import {input_folder}` 导入到 MeterSphere
