# /sbux:git 使用指南

> Git 操作统一入口，支持分支管理、代码提交、推送和 PR 操作

## 工作流定位

```
开发流程：
  /sbux:proposal → /sbux:apply → /sbux:review → [/sbux:git] → /sbux:deploy → (/sbux:fix 循环)
                                                     ↑
                                                 当前位置
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:apply 或 /sbux:fix 完成的代码 | **/sbux:git** | /sbux:deploy（发布） |

---

## 快速开始

### 前置条件

- 代码变更已完成
- 在 Git 仓库中

### 基本用法

```bash
# 查看状态
/sbux:git status

# 提交代码
/sbux:git commit

# 推送到远程
/sbux:git push

# 创建 PR
/sbux:git pr create
```

---

## 子命令一览

### 基础操作

| 命令 | 说明 | 示例 |
|------|------|------|
| status | 查看仓库状态 | `/sbux:git status` |
| log | 查看提交历史 | `/sbux:git log` |
| diff | 查看变更内容 | `/sbux:git diff` |
| pull | 拉取远程更新 | `/sbux:git pull` |

### 分支操作

| 命令 | 说明 | 示例 |
|------|------|------|
| checkout | 切换/创建分支 | `/sbux:git checkout feature/login` |
| branch | 分支管理 | `/sbux:git branch -d old-branch` |
| merge | 合并分支 | `/sbux:git merge feature/login` |
| stash | 暂存变更 | `/sbux:git stash` |

### 提交与推送

| 命令 | 说明 | 示例 |
|------|------|------|
| commit | 分析变更并提交 | `/sbux:git commit` |
| push | 推送到远程 | `/sbux:git push` |

### PR 操作

| 命令 | 说明 | 示例 |
|------|------|------|
| pr list | 列出 PR | `/sbux:git pr list` |
| pr create | 创建 PR | `/sbux:git pr create` |
| pr view | 查看 PR 详情 | `/sbux:git pr view 123` |
| pr comment | 回复评论 | `/sbux:git pr comment 123` |

---

## 最佳实践

1. **原子提交** - 一次提交只做一件事，便于回滚和审查

2. **有意义的 commit message** - 说明"做了什么"而非"怎么做"

3. **不提交敏感信息** - 检查 .env、密钥等文件是否被忽略

4. **先 review 再 commit** - 确保代码质量后再提交

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| PR 操作需要 Token | 运行 /sbux:winit 配置 GitHub Token |
| push 失败（远程有更新） | 先 `/sbux:git pull` 再 push |
| 想撤销最近的提交 | `git reset --soft HEAD~1` |
| 分支冲突 | 解决冲突后 `git add` + `git commit` |

---

## 下一步

代码提交后：

- 部署到测试环境 → `/sbux:deploy stg`
- 等待 PR 审批 → `/sbux:git pr view {number}`
