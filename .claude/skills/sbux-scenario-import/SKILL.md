---
name: sbux:scenario-import
description: MeterSphere 场景导入/更新。从 Excel 批量导入或更新场景到 MeterSphere。触发词：scenario-import、导入场景、批量导入场景、场景更新、更新场景。
---

# MeterSphere 场景导入/更新

## 参数

- `$ARGUMENTS`：输入文件夹路径（必填）

## Step 1: 识别操作模式

根据用户的自然语言判断操作模式：

| 用户意图关键词 | 模式 |
|----------------|------|
| 导入、import、新增、创建 | import |
| 更新、update、修改、同步 | update |

**更新模式**额外需要用户提供场景编号（case_num），格式如 `TC001,TC002,TC003`。

## Step 2: 读取配置

1. 读取 `metersphere` 配置（两个配置文件合并，local 覆盖共享）：
   - `workflow-config.yaml`（共享）：`base_url`
   - `workflow-config.local.yaml`（敏感）：`access_key`、`secret_key`

2. 读取 `{input_folder}/scenario-config.yaml` 中的项目配置：
   - `project_id`（由 proposal 阶段从模板自动提取）
   - `template_scenario_id`
   - `module_id`

如果配置不存在，提示用户先运行 `/sbux:scenario-proposal` 生成配置。

## Step 3: 调用脚本

### 导入模式（import）

```bash
python3 scripts/ms_scenario_import.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --project-id "<project_id>" \
  --template-id "<template_scenario_id>" \
  --module-id "<module_id>" \
  --excel-path "{input_folder}/scenarios.xlsx" \
  --mode import
```

脚本自动完成：
1. 筛选 `status = 待导入` 的行
2. 调用 MS API 创建场景
3. 回写 Excel：A 列(scenario_id)、B 列(scenario_uuid)、C 列(status=已导入)

### 更新模式（update）

```bash
python3 scripts/ms_scenario_import.py \
  --base-url "<ms_base_url>" \
  --access-key "<ms_access_key>" \
  --secret-key "<ms_secret_key>" \
  --project-id "<project_id>" \
  --template-id "<template_scenario_id>" \
  --module-id "<module_id>" \
  --excel-path "{input_folder}/scenarios.xlsx" \
  --mode update \
  --case-nums "<case_nums>"
```

脚本自动完成：
1. 筛选 `case_num`（D列）匹配指定编号的行
2. 检查必需的 `scenario_uuid`（B列）
3. 调用 MS API 更新场景
4. 回写 Excel：C 列(status=已更新)

## 完成

根据脚本输出向用户报告结果：
- 操作模式（导入/更新）
- 成功数
- 失败数（如有）
- Excel 文件路径

提示用户：
1. 场景已导入/更新到 MeterSphere
2. 可以在 MeterSphere 中查看场景
3. 可以使用 `/sbux:scenario-run` 执行场景
