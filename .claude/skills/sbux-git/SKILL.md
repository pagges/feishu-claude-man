---
name: sbux:git
description: Git 操作。支持分支管理、代码提交、推送和 PR 操作。触发词：git、分支、推送、PR、commit、提交。
---

# /sbux:git - Git 操作

## 描述

统一的 Git 操作命令，支持分支管理、代码提交、推送到远程和 PR（Pull Request）操作。

**模式**：交互式

---

## 子命令

### 基础操作

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `status` | 查看仓库状态 | `/sbux:git status` |
| `log` | 查看提交历史 | `/sbux:git log` |
| `diff` | 查看变更内容 | `/sbux:git diff` |
| `pull` | 拉取远程更新 | `/sbux:git pull` |

### 分支操作

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `checkout` | 切换或创建分支 | `/sbux:git checkout feature/login` |
| `branch` | 分支管理（列出/删除） | `/sbux:git branch -d old-branch` |
| `merge` | 合并分支 | `/sbux:git merge feature/login` |
| `stash` | 暂存/恢复变更 | `/sbux:git stash` |

### 提交与推送

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `commit` | 分析变更并提交代码 | `/sbux:git commit` |
| `push` | 推送到远程仓库 | `/sbux:git push` |

### PR 操作

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `pr list` | 列出当前仓库的 PR | `/sbux:git pr list` |
| `pr create` | 创建新的 PR | `/sbux:git pr create` |
| `pr view` | 查看 PR 详情 | `/sbux:git pr view 123` |
| `pr comment` | 回复 PR 评论 | `/sbux:git pr comment 123` |

---

## 前置检查

### Step 0: 环境检查

1. **检查是否在 Git 仓库中**：
   ```bash
   git rev-parse --is-inside-work-tree
   ```
   如果不在 Git 仓库中，提示用户并终止。

2. **获取仓库信息**：
   ```bash
   # 获取远程仓库 URL
   git remote get-url origin

   # 获取当前分支
   git branch --show-current

   # 获取仓库状态
   git status --short
   ```

3. **解析仓库 owner 和 repo**：
   从远程 URL 中解析（支持 SSH 和 HTTPS 格式）：
   - `git@github.com:owner/repo.git` → owner=owner, repo=repo
   - `https://github.com/owner/repo.git` → owner=owner, repo=repo

---

## 子命令执行流程

### status - 仓库状态

**语法**：`/sbux:git status`

**执行**：
```bash
git status
```

**输出格式**：
```
📍 仓库: git@github.com:owner/repo.git
🌿 分支: feature/login (与 origin/feature/login 同步)

变更文件：
| 状态 | 文件 |
|------|------|
| 修改 | src/login.js |
| 新增 | src/utils.js |

暂存区：无（需要 git add 后才能提交）
```

---

### log - 提交历史

**语法**：`/sbux:git log [-n <count>] [--oneline]`

**参数**：
- `-n <count>` - 显示最近 n 条提交（默认 10）
- `--oneline` - 简洁模式，每条一行

**执行**：
```bash
# 详细模式
git log -n 10 --pretty=format:"%h | %ad | %an | %s" --date=short

# 简洁模式
git log -n 10 --oneline
```

**输出格式**：
```
提交历史（最近 10 条）：

abc1234 | 2024-01-15 | zhangsan | feat: 添加用户登录功能
def5678 | 2024-01-14 | lisi     | fix: 修复订单计算错误
...
```

---

### diff - 变更内容

**语法**：`/sbux:git diff [--staged] [<file>]`

**参数**：
- `--staged` - 查看已暂存的变更
- `<file>` - 指定文件（可选）

**执行**：
```bash
# 未暂存的变更
git diff

# 已暂存的变更
git diff --staged

# 指定文件
git diff <file>
```

**输出**：显示 diff 内容，包含文件路径、行号和变更详情

---

### pull - 拉取更新

**语法**：`/sbux:git pull [--rebase]`

**参数**：
- `--rebase` - 使用 rebase 而非 merge

**执行**：
```bash
# 默认 merge 模式
git pull

# rebase 模式
git pull --rebase
```

**注意**：
- 如果有未提交的更改，先提示用户处理（commit 或 stash）
- 如果发生冲突，显示冲突文件列表并提示解决方法

---

### checkout - 分支切换/创建

**语法**：`/sbux:git checkout <branch> [-b]`

**参数**：
- `<branch>` - 目标分支名称
- `-b` - 可选，创建新分支

**执行**：
```bash
# 切换到已有分支
git checkout <branch>

# 或创建并切换到新分支
git checkout -b <branch>
```

**注意**：
- 如果有未提交的更改，先提示用户处理
- 如果分支不存在，询问是否创建新分支

---

### branch - 分支管理

**语法**：`/sbux:git branch [-d|-D <branch>] [-a]`

**参数**：
- 无参数 - 列出本地分支
- `-a` - 列出所有分支（包括远程）
- `-d <branch>` - 删除已合并的分支
- `-D <branch>` - 强制删除分支

**执行**：
```bash
# 列出本地分支
git branch

# 列出所有分支
git branch -a

# 删除分支
git branch -d <branch>
```

**输出格式**：
```
本地分支：
* main              ← 当前分支
  feature/login
  fix/order-calc

远程分支：
  origin/main
  origin/feature/login
```

**注意**：
- 不能删除当前所在分支
- 强制删除（-D）前会提示确认

---

### merge - 合并分支

**语法**：`/sbux:git merge <branch> [--no-ff]`

**参数**：
- `<branch>` - 要合并的分支
- `--no-ff` - 禁用 fast-forward，强制创建合并提交

**执行**：
```bash
git merge <branch>
```

**注意**：
- 如果有未提交的更改，先提示用户处理
- 如果发生冲突，显示冲突文件列表并提示解决方法：
  ```
  合并冲突！请解决以下文件的冲突：
  - src/login.js
  - src/config.js

  解决后运行：
  git add <file>
  git commit
  ```

---

### stash - 暂存变更

**语法**：`/sbux:git stash [pop|list|drop]`

**参数**：
- 无参数 - 暂存当前变更
- `pop` - 恢复最近的暂存并删除
- `list` - 列出所有暂存
- `drop` - 删除最近的暂存

**执行**：
```bash
# 暂存变更
git stash

# 暂存并添加描述
git stash push -m "message"

# 恢复并删除
git stash pop

# 列出暂存
git stash list

# 删除暂存
git stash drop
```

**输出格式（list）**：
```
暂存列表：
stash@{0}: WIP on main: abc1234 feat: 添加登录功能
stash@{1}: On main: 临时保存
```

---

### commit - 代码提交

**语法**：`/sbux:git commit [message]`

**参数**：
- `[message]` - 可选的提交说明或指定文件

**示例**：
- `/sbux:git commit` - 自动分析所有变更
- `/sbux:git commit 修复登录bug` - 指定提交说明
- `/sbux:git commit src/user.js` - 指定文件

**前置信息收集**：
```bash
echo "=== Git 状态 ==="
git status

echo ""
echo "=== 变更内容 ==="
git diff
git diff --cached

echo ""
echo "=== 最近提交风格 ==="
git log --oneline -5
```

**执行流程**：

1. **分析变更**：
   - 查看 `git status` 了解变更文件
   - 查看 `git diff` 理解具体改动
   - 分析变更类型：
     - `feat`: 新功能
     - `fix`: Bug 修复
     - `refactor`: 重构
     - `docs`: 文档
     - `style`: 格式调整
     - `test`: 测试
     - `chore`: 构建/工具

2. **生成 Commit Message**：

   **格式**：
   ```
   <type>: <简短描述>

   <详细说明>
   - 要点1
   - 要点2
   ```

   **示例**：
   ```
   feat: 添加用户注册功能

   新增用户注册模块：
   - 实现邮箱验证流程
   - 添加密码强度校验
   - 集成短信验证码服务
   ```

   **规范**：
   - 第一行（标题）：不超过 50 字符，概括性描述
   - 空一行后写详细说明（必须）
   - 详细说明：用列表形式说明具体改动点
   - 使用中文描述
   - 说明"做了什么"而非"怎么做"

3. **执行提交**：
   ```bash
   # 添加变更文件
   git add <files>

   # 提交
   git commit -m "<message>"
   ```

4. **确认结果**：
   ```bash
   git log --oneline -1
   git status
   ```

**输出格式**：

提交成功：
```
✅ 提交完成

📝 Commit: abc1234
📋 Message:
   feat: 添加用户注册功能

   新增用户注册模块：
   - 实现邮箱验证流程
   - 添加密码强度校验

📊 变更统计：
├── 新增: 2 个文件
├── 修改: 3 个文件
└── 删除: 0 个文件
```

无变更：
```
ℹ️ 没有需要提交的变更

当前状态：工作区干净
```

**注意事项**：
- 不要提交敏感信息：检查是否有 .env、密钥等文件
- 检查 .gitignore：确保不必要的文件被忽略
- 原子提交：一次提交只做一件事
- 有意义的消息：让人能理解这次提交做了什么

---

### push - 推送到远程

**语法**：`/sbux:git push [-f] [-u]`

**参数**：
- `-f` - 强制推送（谨慎使用）
- `-u` - 设置上游分支

**执行**：
```bash
# 检查是否有上游分支
git rev-parse --abbrev-ref --symbolic-full-name @{u}

# 如果没有上游分支，设置上游并推送
git push -u origin <current-branch>

# 如果有上游分支，直接推送
git push
```

**注意**：
- 强制推送前需要用户确认
- 如果推送失败（如远程有新提交），提示用户先 pull

---

### pr list - 列出 PR

**语法**：`/sbux:git pr list [--state open|closed|all]`

**参数**：
- `--state` - PR 状态过滤，默认 `open`

**前置**：需要 GitHub Token（见 Token 检查机制）

**执行**：
```bash
curl -s -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/repos/<owner>/<repo>/pulls?state=<state>"
```

**输出格式**：
```
PR 列表 (open):

#123 [feat] 添加用户登录功能
     作者: zhangsan | 创建: 2024-01-15 | 分支: feature/login → main

#120 [fix] 修复订单计算错误
     作者: lisi | 创建: 2024-01-14 | 分支: fix/order-calc → main
```

---

### pr create - 创建 PR

**语法**：`/sbux:git pr create`

**前置**：需要 GitHub Token

**执行流程**：

1. **收集信息**（使用 AskUserQuestion）：
   - `title` - PR 标题
   - `base` - 目标分支（默认 main/master）
   - `body` - PR 描述（可选）

2. **创建 PR**：
   ```bash
   curl -s -X POST \
        -H "Authorization: token <TOKEN>" \
        -H "Accept: application/vnd.github+json" \
        "<API_URL>/repos/<owner>/<repo>/pulls" \
        -d '{
          "title": "<title>",
          "head": "<current-branch>",
          "base": "<base>",
          "body": "<body>"
        }'
   ```

3. **输出**：
   ```
   PR 创建成功！

   #125 [feat] 添加用户登录功能
   URL: https://github.com/owner/repo/pull/125
   分支: feature/login → main
   ```

---

### pr view - 查看 PR 详情

**语法**：`/sbux:git pr view <number>`

**参数**：
- `<number>` - PR 编号

**前置**：需要 GitHub Token

**执行**：
```bash
# 获取 PR 详情
curl -s -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/repos/<owner>/<repo>/pulls/<number>"

# 获取 PR 评论
curl -s -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/repos/<owner>/<repo>/pulls/<number>/comments"

# 获取 Issue 评论（PR 的一般性评论）
curl -s -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/repos/<owner>/<repo>/issues/<number>/comments"
```

**输出格式**：
```
PR #123: [feat] 添加用户登录功能

状态: open | 作者: zhangsan | 创建: 2024-01-15
分支: feature/login → main
URL: https://github.com/owner/repo/pull/123

--- 描述 ---
实现用户登录功能，包括：
- 邮箱密码登录
- 记住登录状态

--- 评论 (3) ---

[2024-01-15 10:30] lisi:
  代码看起来不错，有一个小建议...

[2024-01-15 11:00] zhangsan:
  好的，已经修改了

[2024-01-15 14:00] wangwu:
  LGTM!
```

---

### pr comment - 回复 PR 评论

**语法**：`/sbux:git pr comment <number> [message]`

**参数**：
- `<number>` - PR 编号
- `[message]` - 评论内容（可选，如不提供则交互式输入）

**前置**：需要 GitHub Token

**执行**：
```bash
# 添加 Issue 评论（PR 的一般性评论）
curl -s -X POST \
     -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/repos/<owner>/<repo>/issues/<number>/comments" \
     -d '{"body": "<message>"}'
```

**输出**：
```
评论已添加到 PR #123

内容: 已修复，请重新 review
```

---

## Token 检查机制

在执行 PR 相关操作前，检查 GitHub Token 配置：

### Step 1: 读取配置

依次读取两个配置文件（local 文件的值覆盖共享文件）：

1. `workflow-config.yaml`（共享配置）：
```yaml
github:
  api_url: "https://api.github.com"
```

2. `workflow-config.local.yaml`（敏感配置）：
```yaml
github:
  token: "ghp_xxxx"
```

### Step 2: Token 缺失处理

如果 `github.token` 未配置或为空：

1. **提示用户**：
   ```
   未检测到 GitHub Token 配置。

   PR 操作需要 Personal Access Token (classic) 来调用 GitHub API。
   ```

2. **使用 AskUserQuestion 收集配置**：
   - `github_api_url` - GitHub API 地址（默认 https://scm.starbucks.com/api/v3）
   - `github_token` - Personal Access Token

3. **保存到配置文件**：
   - `api_url` 保存到 `workflow-config.yaml`
   - `token` 保存到 `workflow-config.local.yaml`（敏感信息）

### Step 3: Token 验证

验证 Token 是否有效：
```bash
curl -s -H "Authorization: token <TOKEN>" \
     -H "Accept: application/vnd.github+json" \
     "<API_URL>/user"
```

如果返回用户信息，Token 有效；否则提示重新配置。

---

## 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 不在 Git 仓库中 | 提示用户并终止 |
| 无法解析远程 URL | 提示用户检查 git remote 配置 |
| Token 无效或过期 | 引导用户重新配置 Token |
| API 请求失败 | 显示错误信息，建议检查网络或权限 |
| 分支不存在 | 询问是否创建新分支 |
| 推送失败 | 提示先 pull 远程更新 |
| pull 冲突 | 显示冲突文件，提示解决方法 |
| merge 冲突 | 显示冲突文件，提示解决方法 |
| 删除当前分支 | 提示先切换到其他分支 |
| stash 为空 | 提示没有可恢复的暂存 |

---

## 注意事项

1. **SSH Key vs PAT Token**：
   - Git 操作（checkout、commit、push）使用 SSH Key 认证
   - GitHub API 操作（PR 相关）使用 PAT Token 认证

2. **Token 安全**：
   - Token 存储在本地 `workflow-config.local.yaml`（敏感配置文件）
   - 确保该文件已加入 .gitignore，不被提交到版本控制

3. **私有部署支持**：
   - 支持 GitHub Enterprise，只需配置正确的 `api_url`
   - 默认：`https://scm.starbucks.com/api/v3`

4. **权限要求**：
   - PAT Token 需要 `repo` 权限（完整仓库访问）
   - 如需创建/回复评论，还需要 `write:discussion` 权限
