---
name: sbux:scenario-run
description: QA 场景执行。从 Excel 读取场景并批量执行，更新执行结果。触发词：scenario-run、执行QA场景、运行QA场景。
---

# QA 场景执行

## 参数

- `{input_folder}`：输入文件夹路径（必填）
- `environment_id`：环境 ID（可选，通过参数传入或交互式询问）

## 执行流程

### Step 1: 读取配置

1. 读取 `metersphere` 配置（两个配置文件合并，local 覆盖共享）：
   - `workflow-config.yaml`（共享）：`base_url`
   - `workflow-config.local.yaml`（敏感）：`access_key`、`secret_key`
2. 读取 `{input_folder}/scenario-config.yaml` 中的项目配置

### Step 2: 读取 Excel

读取 `{input_folder}/scenarios.xlsx` 或 `scenarios-new.xlsx` Sheet1：
- 筛选 `status = 已导入`（C 列）的场景
- 获取 `scenario_uuid`（B 列）作为场景 ID
- 获取 `name`（F 列）作为场景名称

如果没有已导入的场景，提示用户先运行 `/sbux:scenario-import`。

### Step 3: 使用 AskUserQuestion 确认执行

询问用户：
1. **环境 ID** - 如果参数未传入，询问用户提供环境 ID（从 MeterSphere 项目设置 → 环境管理获取）
2. **执行范围** - 全部执行 / 选择部分执行
3. **执行模式** - 串行（serial）/ 并行（parallel），默认串行
4. **报告模式** - 等待并获取报告（默认）/ 仅触发执行（不等待）

如果选择部分执行，展示场景列表让用户选择。

### Step 4: 执行场景

**默认模式（等待并获取报告）**：
```bash
python3 scripts/ms_scenario_run.py \
  --base-url "<base_url>" \
  --access-key "<access_key>" \
  --secret-key "<secret_key>" \
  --project-id "<project_id>" \
  --environment-id "<environment_id>" \
  --ids "<id1>,<id2>,..." \
  --mode "<serial|parallel>" \
  --report-name "QA场景执行_$(date +%Y%m%d_%H%M%S)" \
  --wait \
  --timeout 600
```

**仅触发执行（不等待报告）**：
```bash
python3 scripts/ms_scenario_run.py \
  --base-url "<base_url>" \
  --access-key "<access_key>" \
  --secret-key "<secret_key>" \
  --project-id "<project_id>" \
  --environment-id "<environment_id>" \
  --ids "<id1>,<id2>,..." \
  --mode "<serial|parallel>" \
  --report-name "QA场景执行_$(date +%Y%m%d_%H%M%S)"
```

参数说明：
- `--base-url`: MeterSphere 服务地址
- `--access-key`: API 访问密钥
- `--secret-key`: API 密钥
- `--project-id`: 项目 ID
- `--environment-id`: 环境 ID（运行时必需）
- `--ids`: 场景 ID 列表（逗号分隔）
- `--mode`: 执行模式，serial（串行）或 parallel（并行）
- `--report-name`: 报告名称
- `--wait`: 等待执行完成（不传则仅触发，返回 reportId）
- `--timeout`: 超时时间（秒，默认 600，场景较长）

### Step 5: 获取报告

**等待模式**：脚本自动轮询报告状态直到完成，输出详细执行结果。

**仅触发模式**：脚本立即返回 `reportId`，用户可稍后使用 `--wait` 重新执行或通过 MeterSphere 界面查看。

### Step 6: 查询失败日志（可选）

如果有失败的场景，询问用户是否查询相关日志：

**询问选项**：
- 查询失败场景日志（推荐）
- 跳过日志查询

**查询日志**（选择查询时执行）：

使用 `/sbux:log-query` Skill 查询日志，参数：
- keyword: `<partnerOrderId>,<x-transaction-id>,<memberId>` 等业务标识（多个用逗号分隔，OR 逻辑匹配）
- index: `stg:*upp*`
- days: `0`
- size: `100`

**日志关键词提取**：
- 从失败场景的请求参数中提取 `partnerOrderId`、`x-transaction-id`、`memberId` 等业务标识
- 多个关键词用逗号分隔传给 `/sbux:log-query`，支持 OR 逻辑匹配

### Step 8: 更新 Excel

更新 Sheet1 中对应场景的执行结果：
- 添加「最后执行时间」列（如果不存在）
- 添加「执行结果」列（如果不存在）
- 添加「通过率」列（如果不存在）
- 更新执行时间、结果（Success/Error/Failed）和通过率

## 输出格式

### 执行汇总

| 状态 | 总步骤 | 成功 | 失败 | 通过率 |
|------|--------|------|------|--------|
| X | X | X | X | XX% |

### 断言统计

| 通过断言 | 失败断言 |
|----------|----------|
| X | X |

### 失败场景详情

如果有失败，展示：
- 场景编号
- 场景名称
- 失败步骤
- 失败原因

### 相关日志（如果查询）

```
2024-01-26 10:30:15 ERROR PaymentService - Transaction failed: timeout
2024-01-26 10:30:16 WARN  OrderService - Retry attempt 1/3
...
```

### 更新的文件

- `{input_folder}/scenarios.xlsx` 或 `scenarios-new.xlsx` - 已更新执行结果
