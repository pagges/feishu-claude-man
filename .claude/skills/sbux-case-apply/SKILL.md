---
name: sbux:case-apply
description: QA 用例代码编写。基于用例需求 Excel 编写具体的测试代码。触发词：case-apply、用例实现、编写用例。
---

# QA 用例代码编写

## 参数

- `$ARGUMENTS`：输入文件夹路径（必填）

## Step 1: 读取输入

读取 `{input_folder}/cases.xlsx`：
- 筛选 `status = 待实现` 的用例作为待处理列表
- 筛选 `status = 模板示例` 的用例作为模板参考

如果没有待实现的用例，提示用户并退出。

## Step 2: 读取需求文档

读取输入文件夹中的需求文档，理解测试场景和业务规则：
- 产品需求文档
- 测试需求文档
- 接口文档

## Step 3: 生成测试代码

对于每个待实现的用例，根据 **test_summary（H 列）** 和 **同接口的模板用例** 生成具体代码。

**核心原则**：基于模板用例进行拓展，保持结构一致性。

### 3.1 headers (M列)

基于模板 headers 结构，根据测试场景调整。示例：
```json
[{"name": "Content-Type", "value": "application/json", "enable": true}]
```

### 3.2 body (N-O列)

基于模板 body 结构，根据 test_summary 修改对应字段：
- 正常场景：使用有效值
- 参数缺失：删除字段
- 参数为空：设为 `""`
- 参数为 null：设为 `null`
- 类型错误：修改为错误类型
- 边界值：设为边界值

### 3.3 断言 (P-R列)

基于模板断言格式，根据预期结果调整：

**assert_json (P列)**：
```json
[{"expression": "$.statusCode", "expect": "100", "option": "EQUALS"}]
```

option 类型：`EQUALS` / `CONTAINS` / `NOT_CONTAINS` / `REGEX`

**assert_regex (Q列)**：正则断言（可选）

**assert_duration (R列)**：响应时间断言，毫秒（可选）

### 3.4 前置脚本 (S列)

基于模板前置脚本，根据测试场景调整动态数据生成逻辑。

### 3.5 后置处理 (T-U列)

**post_jdbc (T列)**：基于模板 JDBC 查询，调整验证逻辑。

**post_script (U列)**：基于模板后置脚本，调整断言逻辑。

## Step 4: 更新 Excel

使用 openpyxl 更新 `{input_folder}/cases.xlsx`：
- 填充 M-U 列（测试代码）
- 更新 status（E 列）为 `待导入`

## 完成

输出摘要：
- 处理用例数
- 更新的 Excel 文件路径

---

## Step 5: 询问下一步操作

**第一步**：使用 AskUserQuestion 询问用户执行方式：

**提示**：`用例代码编写完成，请选择下一步操作：`

| 选项 | 说明 |
|------|------|
| SubAgent 执行审查（推荐） | 启动独立 SubAgent 执行 /sbux:case-review |
| 当前会话执行审查 | 在当前会话执行审查 |
| 跳过审查直接导入 | 跳过审查，直接导入用例 |
| 不执行 | 结束流程，稍后手动操作 |

**第二步**：如果用户选择了「SubAgent 执行审查」，再使用 AskUserQuestion 询问执行模式：

| 选项 | 说明 |
|------|------|
| 同步等待（推荐） | 等待 SubAgent 完成后返回结果 |
| 异步执行 | 后台运行，当前会话可继续其他工作 |

**用户选择后的行为**：

1. **选择「SubAgent 执行审查」**：
   - 询问同步/异步后：
   - **同步**：Task(subagent_type: "general-purpose", prompt: "/sbux:case-review {input_folder}")
   - **异步**：Task(subagent_type: "general-purpose", run_in_background: true, prompt: "/sbux:case-review {input_folder}")

2. **选择「当前会话执行审查」**：Skill(sbux:case-review, args: "{input_folder}")

3. **选择「跳过审查直接导入」**：Skill(sbux:case-import, args: "{input_folder}")

4. **选择「不执行」**：结束并提示

**后续提示**：
1. 审核 `cases.xlsx` 中的测试代码
2. 可以修改断言、脚本等
3. 审查完成后运行 `/sbux:case-import {input_folder}` 导入到 MeterSphere
