---
name: sbux:winit
description: 初始化工作流配置。交互式生成 workflow-config.yaml 配置文件。触发词：winit、初始化配置。
---

# 工作流配置初始化

交互式生成配置文件。

**配置文件拆分**：

- `workflow-config.yaml` - 共享配置（地址、应用列表等），可提交到 Git
- `workflow-config.local.yaml` - 敏感配置（keys、tokens），加入 .gitignore

## 配置流程

### Step 1: 选择要配置的模块

使用 AskUserQuestion（multiSelect: true）询问用户要配置哪些模块：

| 选项                | 默认   | 说明                              |
|-------------------|------|---------------------------------|
| 执行 /init（项目初始化）   | ✓ 选中 | 完成后自动执行 `/init`                 |
| Deploy（云效发布）      | 未选中  | 配置 `/sbux:deploy` 命令                 |
| Log Query（日志查询）   | 未选中  | 配置 `/sbux:log-query` 命令              |
| MeterSphere（测试平台） | 未选中  | 配置 `/case-*` 和 `/scenario-*` 命令 |
| GitHub（代码托管）      | 未选中  | 配置 `/sbux:git` 命令的 PR 操作             |

用户可多选或全部跳过。跳过的模块不会出现在配置文件中。

---

### Step 2: 按选中模块依次配置

对于每个选中的模块，询问所有配置项。

#### 2.1 Deploy 配置

| 配置项            | 必填 | 默认值                                    | 说明                        |
|----------------|----|----------------------------------------|---------------------------|
| app_name       | ✓  | -                                      | 应用名称                      |
| token          | ✓  | -                                      | API Token（敏感，写入 local 文件） |
| base_url       |    | `https://yunxiao.starbucks.net`        | 云效地址                      |
| org_id         |    | `51064b92-15c9-433d-9021-8c0997b98fef` | 组织 ID                     |
| default_branch |    | `stg`                                  | 默认分支                      |
| default_stage  |    | `stg`                                  | 默认工作流                     |
| release_stage  |    | `cfdc-构建部署`                            | 发布阶段                      |

询问是否添加更多应用，循环直到用户选择完成。

#### 2.2 Log Query 配置

| 配置项          | 必填 | 默认值                                      | 说明                 |
|--------------|----|------------------------------------------|--------------------|
| index_value  | ✓  | -                                        | 索引值（如 `stg:*upp*`） |
| base_url     |    | `http://arex.stg.sbuxcf.net/repeaterApi` | 日志服务地址             |
| default_days |    | `0`                                      | 默认查询天数             |
| default_size |    | `100`                                    | 默认返回条数             |

询问是否添加更多索引，循环直到用户选择完成。

#### 2.3 MeterSphere 配置

| 配置项        | 必填 | 默认值                                       | 说明                             |
|------------|----|-------------------------------------------|--------------------------------|
| access_key | ✓  | -                                         | API Access Key（敏感，写入 local 文件） |
| secret_key | ✓  | -                                         | API Secret Key（敏感，写入 local 文件） |
| base_url   |    | `http://stgstplatform.starbucks.net:8081` | MeterSphere 地址                 |

#### 2.4 GitHub 配置

| 配置项     | 必填 | 默认值                                | 说明                                                                     |
|---------|----|------------------------------------|------------------------------------------------------------------------|
| token   | ✓  | -                                  | Personal Access Token（敏感，写入 local 文件，需要 `repo`, `write:discussion` 权限） |
| api_url |    | `https://scm.starbucks.com/api/v3` | GitHub API 地址                                                          |

---

## 生成配置文件

生成两个配置文件，分离共享配置和敏感配置：

### workflow-config.yaml（共享配置）

使用 Write 工具在当前工作目录生成 `workflow-config.yaml`：

```yaml
# workflow-config.yaml
# AI Workflow 共享配置文件
# 可以提交到 Git 仓库

# 如果选中了 Deploy
deploy:
  base_url: "<base_url>"
  org_id: "<org_id>"
  apps:
    - name: "<app_name>"
      default_branch: "<default_branch>"
      default_stage: "<default_stage>"
      release_stage: "<release_stage>"

# 如果选中了 Log Query
log_query:
  base_url: "<base_url>"
  default_index: "<第一个索引>"
  default_days: <days>
  default_size: <size>
  indexes:
    - "<index_value>"

# 如果选中了 MeterSphere（只包含非敏感配置）
metersphere:
  base_url: "<base_url>"

# 如果选中了 GitHub（只包含非敏感配置）
github:
  api_url: "<api_url>"
```

### workflow-config.local.yaml（敏感配置）

使用 Write 工具在当前工作目录生成 `workflow-config.local.yaml`：

```yaml
# workflow-config.local.yaml
# AI Workflow 敏感配置文件
# 请勿提交到 Git 仓库！

# 如果选中了 Deploy
deploy:
  token: "<token>"

# 如果选中了 MeterSphere
metersphere:
  access_key: "<access_key>"
  secret_key: "<secret_key>"

# 如果选中了 GitHub
github:
  token: "<token>"
```

**配置合并规则**：读取时 `workflow-config.local.yaml` 的值会覆盖 `workflow-config.yaml` 的同名配置。

## 完成

生成配置文件后：

1. 告知用户配置文件已生成：
    - `workflow-config.yaml` - 共享配置，可提交到 Git
    - `workflow-config.local.yaml` - 敏感配置，请勿提交
2. 列出已配置的模块
3. **更新 .gitignore**：如果 `workflow-config.local.yaml` 不在 .gitignore 中，自动追加：
   ```
   # AI Workflow 敏感配置
   workflow-config.local.yaml
   ```
4. **如果用户选中了"执行 /init"**，自动执行 `/init` 命令
5. 如需修改，可直接编辑文件或重新运行 `/sbux:winit`
