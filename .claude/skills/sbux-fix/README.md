# /sbux:fix 使用指南

> 根据问题描述定位并修复代码问题

## 工作流定位

```
开发流程：
  /sbux:proposal → /sbux:apply → /sbux:review → /sbux:git → /sbux:deploy
                                      ↓                          ↓
                                 [/sbux:fix] ←───────────── QA 测试失败
                                      ↑
                                  当前位置
                                      ↓
                        /sbux:git → /sbux:deploy → 回归验证
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 问题描述（来自 review、QA、用户） | **/sbux:fix** | /sbux:git → /sbux:deploy |
| 错误日志、堆栈信息 | | 回归验证 |

---

## 快速开始

### 前置条件

- 清晰的问题描述
- 最好有错误信息或堆栈

### 基本用法

```bash
/sbux:fix 用户注册时邮箱验证失败，错误信息：Invalid email format
```

### 常见场景

**修复 review 发现的问题**
```bash
/sbux:fix review 报告中的 ERROR：API 响应缺少 status 字段
```

**修复测试失败**
```bash
/sbux:fix case-run 失败：testUserLogin 断言失败，expected 200 but got 401
```

**修复线上问题**
```bash
/sbux:fix 生产环境报错：NullPointerException at UserService.java:123
```

### 多任务并行修复

当有多个问题需要修复时，可以一次性提交，系统会自动启动 SubAgent 并行处理：

```bash
/sbux:fix review 报告中的以下问题：
1. UserService.java:42 缺少空值检查
2. OrderController.java:88 响应缺少 status 字段
3. PaymentService.java:156 异常未正确处理
```

**执行方式**：
- **SubAgent 并行执行**（推荐）- 启动多个 SubAgent 同时修复，效率更高
- **顺序执行** - 当前会话逐个修复，适合有依赖关系的任务

---

## 最佳实践

1. **问题描述越详细越好** - 包含错误信息、堆栈、复现步骤

2. **最小改动原则** - 只修复问题本身，避免顺手重构

3. **修复后必须验证** - 确保问题已解决且未引入新问题

4. **结合日志排查** - 使用 `/sbux:log-query` 获取日志和链路上下文

---

## 问题来源

| 来源 | 典型场景 | 信息获取 |
|------|---------|---------|
| /sbux:review | 代码审查发现问题 | review-report.md |
| /sbux:case-run | 用例执行失败 | 执行结果 + /sbux:log-query |
| /sbux:scenario-run | 场景执行失败 | 执行结果 + /sbux:log-query |
| 用户反馈 | 线上问题 | 错误截图、日志 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 无法定位问题根因 | 使用 /sbux:log-query 查看详细日志和链路 |
| 修复后出现新问题 | 回滚修复，重新分析问题 |
| 问题涉及多个模块 | 分步修复，每步验证 |

---

## 下一步

修复完成后：

- 提交代码 → `/sbux:git commit`
- 部署验证 → `/sbux:deploy stg`
- 执行回归 → `/sbux:case-run` 或 `/sbux:scenario-run`
