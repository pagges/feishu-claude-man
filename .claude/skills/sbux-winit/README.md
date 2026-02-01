# /sbux:winit 使用指南

> 初始化工作流配置，为其他 skill 提供配置基础

## 工作流定位

```
所有工作流的前置配置
       ↓
   [ /sbux:winit ]
       ↓
   ┌───┴───┐
   ↓       ↓
开发流程  QA流程
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 无（首次使用时执行） | **/sbux:winit** | 所有其他 skill |

---

## 快速开始

### 前置条件

- 在项目根目录下执行
- 准备好各服务的配置信息（Token、URL 等）

### 基本用法

```bash
/sbux:winit
```

交互式引导完成配置，支持选择需要的模块。

---

## 最佳实践

1. **敏感信息分离** - Token、密码等敏感信息自动存入 `workflow-config.local.yaml`，确保该文件已加入 `.gitignore`

2. **按需配置** - 只选择实际需要的模块，避免配置冗余

3. **团队共享** - `workflow-config.yaml` 可提交到仓库，团队成员只需配置本地敏感信息

---

## 配置模块

| 模块 | 用途 | 关联 Skill |
|------|------|-----------|
| Deploy | 云效发布 | /sbux:deploy |
| Log Query | ES 日志查询 | /sbux:log-query |
| MeterSphere | 测试平台 | /sbux:case-*, /sbux:scenario-* |
| GitHub | PR 操作 | /sbux:git pr |

---

## 输出产物

| 产物 | 位置 | 说明 |
|------|------|------|
| 共享配置 | `workflow-config.yaml` | 可提交到仓库 |
| 敏感配置 | `workflow-config.local.yaml` | 不可提交（含 Token） |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 配置后 skill 仍报错 | 检查 local 文件中的 Token 是否正确 |
| 想修改已有配置 | 直接编辑 yaml 文件，或重新运行 /sbux:winit |
| 新成员如何配置 | 拉取代码后运行 /sbux:winit，只需填写敏感信息 |

---

## 下一步

配置完成后，可以开始使用工作流：

- 开发新功能 → `/sbux:proposal`
- 编写 QA 用例 → `/sbux:case-proposal`
- 编写 QA 场景 → `/sbux:scenario-proposal`
