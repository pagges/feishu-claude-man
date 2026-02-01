---
name: sbux:scenario-proposal
description: QA 场景需求生成。分析需求文档，同步模板场景，生成测试场景需求 Excel。触发词：scenario-proposal、场景需求、场景提案。
---

# QA 场景需求生成

## 参数

- `$ARGUMENTS`：输入文件夹路径（必填）

## Step 1: 读取全局配置

读取 `metersphere` 配置（两个配置文件合并，local 覆盖共享）：

`workflow-config.yaml`（共享配置）：
```yaml
metersphere:
  base_url: "http://xxx"
```

`workflow-config.local.yaml`（敏感配置）：
```yaml
metersphere:
  access_key: "xxx"
  secret_key: "xxx"
```

如果配置不存在，提示用户先运行 `/sbux:winit` 初始化配置。

## Step 2: 验证输入文件夹

检查输入文件夹是否存在以下文件：

```
{input_folder}/
├── *.md                    # 需求/接口文档（自动识别）
└── *.json                  # OpenAPI/Swagger（可选）
```

## Step 3: 询问模板场景 ID

使用 AskUserQuestion 询问用户模板场景 ID：

```
请提供模板场景 ID（从 MeterSphere 场景详情 URL 获取，例如：82884aaa-453f-4b1f-94e6-3e48a36c4fa4）
```

## Step 4: 同步模板场景

调用 MS export API 获取模板场景的完整定义：

```bash
python3 scripts/ms_scenario_export.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --scenario-id "<template_scenario_id>" \
  --format "full"
```

从返回数据中自动提取：
- `projectId` → project_id
- `apiScenarioModuleId` → module_id
- `modulePath` → module_path

解析场景数据，填充到 Excel：
- Sheet1: 场景基本信息（A-L 列）
- Sheet2: 步骤详情（从 scenarioDefinition.hashTree 解析）
- status（C 列）= `模板示例`

## Step 5: 分析需求文档

读取输入文件夹中的所有文档：
- 产品需求文档（理解业务流程）
- 测试需求文档（理解测试范围）
- 接口文档（理解参数变化）

## Step 6: 生成新场景需求

根据需求分析，识别需要基于模板生成的测试场景。

新场景只填充需求描述字段（Sheet1），不填写步骤详情：
- scenario_id/scenario_uuid（A-B 列）：留空（import 回写）
- status（C 列）= `待实现`
- test_steps（I 列）：描述测试流程，格式如「【场景类型】测试目的：1.操作步骤；2.验证点」

## Step 7: 输出 Excel

基于固定模板 `templates/scenario-template.xlsx` 生成 `{input_folder}/scenarios.xlsx`。

同时生成 `{input_folder}/scenario-config.yaml` 保存从模板提取的配置：
```yaml
# 自动从模板场景提取
project_id: "<projectId>"
module_id: "<apiScenarioModuleId>"
template_scenario_id: "<template_scenario_id>"
```

## 完成

输出摘要：
- 模板场景数（status=模板示例，从 MS 同步）
- 新增场景数（status=待实现，根据需求生成）
- Excel 文件路径

提示用户：
1. 审核 `scenarios.xlsx` 中的场景需求
2. 可以修改、删除或补充场景
3. 完成后运行 `/sbux:scenario-apply {input_folder}` 编写步骤详情
