# /sbux:case-run 使用指南

> 从 Excel 读取用例并批量执行，更新执行结果

## 工作流定位

```
QA 用例流程：
  /sbux:case-proposal → /sbux:case-apply → /sbux:case-review → /sbux:case-import → [/sbux:case-run]
                                                                                         ↑
                                                                                     当前位置
                                                                                         │
                                                                    ┌────────────────────┴────────────────────┐
                                                                    ↓                                         ↓
                                                            /sbux:log-query                              /sbux:fix
                                                                    └─────────────────────────────────────────┘
                                                                                         ↓
                                                                                   回归验证
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:case-import 导入的用例 | **/sbux:case-run** | 失败 → /sbux:log-query 排查 |
| /sbux:deploy 部署的环境 | | 修复 → /sbux:fix |
| | | 修复 → /sbux:fix |

---

## 快速开始

### 前置条件

- `/sbux:case-import` 已完成（用例已导入 MeterSphere）
- `/sbux:deploy` 已完成（测试环境已部署）

### 基本用法

```bash
/sbux:case-run /path/to/cases
```

---

## 最佳实践

1. **等待部署完成** - 确保环境已稳定后再执行

2. **失败时查日志** - 使用 `/sbux:log-query` 获取详细信息（支持链路追踪）

3. **关注通过率趋势** - 持续跟踪测试通过率变化

4. **及时反馈问题** - 将失败信息反馈给开发进行 `/sbux:fix`

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| cases.xlsx | /sbux:case-import | status=已导入 的用例 |
| 测试环境 | /sbux:deploy | 已部署的应用 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 执行报告 | 控制台输出 | 执行结果汇总 |
| 更新的 Excel | `{folder}/cases.xlsx` | 执行结果列 |

---

## 执行结果

| 结果 | 含义 | 后续操作 |
|------|------|---------|
| PASS | 用例通过 | 无需处理 |
| FAIL | 用例失败 | 排查 → 修复 → 回归 |
| ERROR | 执行异常 | 检查环境或配置 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 大量失败 | 检查环境是否正常，/sbux:log-query 查日志 |
| 超时失败 | 检查网络或增加超时时间 |
| 断言失败 | 对比预期与实际，修复代码或调整断言 |

---

## 下一步

执行完成后：

- **全部通过** → 完成验证
- **有失败** → `/sbux:log-query` 排查（支持链路追踪）
- **定位问题** → `/sbux:fix` 修复 → `/sbux:git` → `/sbux:deploy` → 回归 `/sbux:case-run`
