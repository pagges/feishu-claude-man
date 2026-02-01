---
name: sbux:case-proposal
description: QA 用例需求生成。分析需求文档，同步现有用例，生成测试用例需求 Excel。触发词：case-proposal、用例需求、测试提案。
---

# QA 用例需求生成

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
├── *.md                     # 需求/接口文档（自动识别）
└── *.json                   # OpenAPI/Swagger（可选）
```

## Step 3: 询问模板用例 ID

使用 AskUserQuestion 询问用户模板用例 ID：

```
请提供模板用例 ID（从 MeterSphere 用例详情 URL 获取，例如：47565232-a545-43d7-aff7-2cb9b16116e1）
```

## Step 4: 获取模板用例信息

调用 MS API 获取模板用例详情：

```bash
python3 scripts/ms_case_get.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --case-id "<template_case_id>"
```

从返回数据中自动提取：
- `projectId` → project_id
- `apiDefinitionId` → api_uuid

## Step 5: 同步现有用例

根据提取的 `api_uuid`，调用 MS API 获取该接口下的所有用例：

```bash
python3 scripts/ms_case_list.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --api-uuid "<api_uuid>"
```

对于每个用例，获取详情并填充到 Excel：
- 所有字段（A-U 列）
- 根据用例内容生成 test_summary（H 列）
- status（E 列）= `模板示例`

## Step 6: 分析需求文档

读取输入文件夹中的所有文档：
- 产品需求文档（理解业务规则）
- 测试需求文档（理解测试范围）
- 接口文档（解析参数和响应结构）
- 数据模型文档（理解字段约束）

## Step 7: 生成新用例需求

根据需求分析，识别缺失的测试场景，生成新的用例需求。

新用例只填充需求描述字段（A-L 列），不编写具体代码：
- api_id/api_uuid（A-B 列）：使用从模板提取的 api_uuid
- status（E 列）= `待实现`
- test_summary（H 列）：描述测试要点，格式如「【场景类型】测试目的：1.操作步骤；2.验证点」

## Step 8: 输出 Excel

基于固定模板 `templates/case-template.xlsx` 生成 `{input_folder}/cases.xlsx`。

同时生成 `{input_folder}/case-config.yaml` 保存从模板提取的配置：
```yaml
# 自动从模板用例提取
project_id: "<projectId>"
api_uuid: "<apiDefinitionId>"
template_case_id: "<template_case_id>"
```

## 完成

输出摘要：
- 模板用例数（status=模板示例，从 MS 同步的现有用例）
- 新增用例数（status=待实现，根据需求生成的新用例）
- Excel 文件路径

提示用户：
1. 审核 `cases.xlsx` 中的用例需求
2. 可以修改、删除或补充用例
3. 完成后运行 `/sbux:case-apply {input_folder}` 编写测试代码
