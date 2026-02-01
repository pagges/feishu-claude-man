---
name: sbux:deploy
description: 云效发布。执行应用流水线发布到指定阶段。触发词：deploy、发布、部署。
---

# 云效发布

## Step 1: 读取配置文件

读取配置文件（两个配置文件合并，local 覆盖共享）：

1. `workflow-config.yaml`（共享配置）：`base_url`、`org_id`、`apps` 等
2. `workflow-config.local.yaml`（敏感配置）：`token`

- **存在**：提取 `deploy` 配置作为默认值
- **不存在**：使用下方硬编码默认值

**硬编码默认值**（配置文件不存在时使用）：
- base_url: `https://yunxiao.starbucks.net`
- org_id: `51064b92-15c9-433d-9021-8c0997b98fef`

## Step 2: 参数收集

使用 AskUserQuestion 工具**一次性询问用户所有参数**（无论是否有默认值）：

1. **app_name** - 应用名称（必填，无默认值）
   - 如果配置文件中有 `deploy.apps`，则作为选项列表供用户选择
2. **branch_name** - 分支名称
   - 如果用户选择了 app，默认值为 `apps[选中].default_branch`
   - 否则默认值为 [stg]
3. **base_url** - 云效地址
   - 默认值为配置文件中的 `deploy.base_url`，或 [https://yunxiao.starbucks.net]
4. **org_id** - 组织ID
   - 默认值为配置文件中的 `deploy.org_id`，或 [51064b92-15c9-433d-9021-8c0997b98fef]
5. **token** - API Token
   - 优先从 `workflow-config.local.yaml` 的 `deploy.token` 读取
   - 如都未设置则让用户手动输入
6. **stage_name** - 工作流名称
   - 如果用户选择了 app，默认值为 `apps[选中].default_stage`
   - 否则默认值为 [stg]，枚举值为 [stg/dev/uat]
7. **release_stage_name** - 发布阶段
   - 如果用户选择了 app，默认值为 `apps[选中].release_stage`
   - 否则默认值为 [cfdc-构建部署]，枚举值为 [cfdc-构建部署/cfdc-构建扫描部署]
8. **comment** - 发布说明
   - 默认从 `git log -1 --pretty=format:"%s"` 获取，让用户确认或修改

**重要**：必须询问所有参数，不能跳过任何一个。

## Step 3: 执行发布

```bash
python3 scripts/yunxiao_client.py \
  --app_name <app_name> \
  --branch_name <branch_name> \
  --base_url <base_url> \
  --org_id <org_id> \
  --token <token> \
  --stage_name <stage_name> \
  --release_stage_name <release_stage_name> \
  --comment <comment>
```
