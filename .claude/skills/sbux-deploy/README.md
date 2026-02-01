# /sbux:deploy 使用指南

> 执行云效流水线发布，部署应用到指定环境

## 工作流定位

```
开发流程：
  /sbux:proposal → /sbux:apply → /sbux:review → /sbux:git → [/sbux:deploy] → (/sbux:fix 循环)
                                                                 ↑
                                                             当前位置
                                                                 │
                                                                 ├──→ /sbux:case-run (QA 用例验证)
                                                                 └──→ /sbux:scenario-run (QA 场景验证)
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:git push 到远程的代码 | **/sbux:deploy** | QA 测试验证 |
| | | 如有问题 → /sbux:fix |

---

## 快速开始

### 前置条件

- 代码已推送到远程仓库
- /sbux:winit 已配置云效信息

### 基本用法

```bash
# 部署到 stg 环境
/sbux:deploy stg

# 部署到 prod 环境
/sbux:deploy prod
```

---

## 最佳实践

1. **先 stg 再 prod** - 测试环境验证通过后再发布生产

2. **填写发布说明** - 便于追溯和回滚

3. **部署后通知 QA** - 及时触发测试验证

4. **关注流水线状态** - 确认部署成功后再进行下一步

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 部署失败 | 检查流水线日志，修复问题后重新部署 |
| 找不到应用 | 确认 workflow-config.yaml 中的应用名正确 |
| 权限不足 | 检查云效 Token 是否有效 |

---

## 下一步

部署完成后：

- 执行 QA 用例 → `/sbux:case-run`
- 执行 QA 场景 → `/sbux:scenario-run`
- 发现问题 → `/sbux:log-query` 排查 → `/sbux:fix` 修复
