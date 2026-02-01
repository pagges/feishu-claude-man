# /sbux:scenario-run 使用指南

> 从 Excel 读取场景并批量执行端到端测试，更新执行结果

## 工作流定位

```
QA 场景流程：
  /sbux:scenario-proposal → /sbux:scenario-apply → /sbux:scenario-review → /sbux:scenario-import → [/sbux:scenario-run]
                                                                                                          ↑
                                                                                                      当前位置
                                                                                                          │
                                                                      ┌───────────────────────────────────┴───────────────────────────────────┐
                                                                      ↓                                                                         ↓
                                                               /sbux:log-query                                                             /sbux:fix
                                                                      └─────────────────────────────────────────────────────────────────────────┘
                                                                                                          ↓
                                                                                                    回归验证
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:scenario-import 导入的场景 | **/sbux:scenario-run** | 失败 → /sbux:log-query 排查 |
| /sbux:deploy 部署的环境 | | 修复 → /sbux:fix |
| | | 修复 → /sbux:fix |

---

## 快速开始

### 前置条件

- `/sbux:scenario-import` 已完成（场景已导入 MeterSphere）
- `/sbux:deploy` 已完成（测试环境已部署）

### 基本用法

```bash
/sbux:scenario-run /path/to/scenarios
```

---

## 最佳实践

1. **场景耗时较长** - 端到端场景涉及多个接口，设置足够的超时时间

2. **失败时查链路** - 使用 `/sbux:log-query` 查看日志和完整调用链路

3. **关注步骤级失败** - 定位具体哪一步失败，缩小排查范围

4. **及时反馈问题** - 将失败信息反馈给开发进行 `/sbux:fix`

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| scenarios.xlsx | /sbux:scenario-import | status=已导入 的场景 |
| 测试环境 | /sbux:deploy | 已部署的应用 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 执行报告 | 控制台输出 | 执行结果汇总 |
| 更新的 Excel | `{folder}/scenarios.xlsx` | 执行结果列 |

---

## 执行结果

| 结果 | 含义 | 后续操作 |
|------|------|---------|
| PASS | 场景通过 | 无需处理 |
| FAIL | 场景失败 | 排查 → 修复 → 回归 |
| ERROR | 执行异常 | 检查环境或配置 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 场景超时 | 增加超时时间，或优化接口性能 |
| 中间步骤失败 | 使用 /sbux:log-query 查看日志和完整链路 |
| 变量传递失败 | 检查前一步的 extract 配置 |

---

## 下一步

执行完成后：

- **全部通过** → 完成验证
- **有失败** → `/sbux:log-query` 排查（支持链路追踪）
- **定位问题** → `/sbux:fix` 修复 → `/sbux:git` → `/sbux:deploy` → 回归 `/sbux:scenario-run`
