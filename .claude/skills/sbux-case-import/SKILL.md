---
name: sbux:case-import
description: MeterSphere 用例导入/更新。从 Excel 批量导入或更新用例到 MeterSphere。触发词：case-import、导入用例、批量导入、用例更新、更新用例。
---

# MeterSphere 用例导入/更新

## 参数

- `$ARGUMENTS`：输入文件夹路径（必填）

## Step 1: 识别操作模式

根据用户的自然语言判断操作模式：

| 用户意图关键词 | 模式 |
|----------------|------|
| 导入、import、新增、创建 | import |
| 更新、update、修改、同步 | update |

**更新模式**额外需要用户提供用例编号（case_id），格式如 `1001,1002,1003`。

## Step 2: 读取配置

1. 读取 `metersphere` 配置（两个配置文件合并，local 覆盖共享）：
   - `workflow-config.yaml`（共享）：`base_url`
   - `workflow-config.local.yaml`（敏感）：`access_key`、`secret_key`

2. 读取 `{input_folder}/case-config.yaml` 中的项目配置：
   - `project_id`（由 proposal 阶段从模板自动提取）
   - `api_uuid`（由 proposal 阶段从模板自动提取）

如果配置不存在，提示用户先运行 `/sbux:case-proposal` 生成配置。

## Step 3: 调用脚本

### 导入模式（import）

```bash
python3 scripts/ms_case_import.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --project-id "<project_id>" \
  --api-uuid "<api_uuid>" \
  --excel-path "{input_folder}/cases.xlsx" \
  --mode import
```

脚本自动完成：
1. 筛选 `status = 待导入` 的行
2. 调用 MS API 创建用例
3. 回写 Excel：C 列(case_id)、D 列(case_uuid)、E 列(status=已导入)

### 更新模式（update）

```bash
python3 scripts/ms_case_import.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --project-id "<project_id>" \
  --api-uuid "<api_uuid>" \
  --excel-path "{input_folder}/cases.xlsx" \
  --mode update \
  --case-ids "<case_ids>"
```

脚本自动完成：
1. 筛选 `case_id`（C列）匹配指定编号的行
2. 检查必需的 `case_uuid`（D列）
3. 调用 MS API 更新用例
4. 回写 Excel：E 列(status=已更新)

## 完成

根据脚本输出向用户报告结果：
- 操作模式（导入/更新）
- 成功数
- 失败数（如有）
- Excel 文件路径

提示用户：
1. 用例已导入/更新到 MeterSphere
2. 可以在 MeterSphere 中查看用例
3. 可以使用 `/sbux:case-run` 执行用例
