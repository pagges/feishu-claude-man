# /sbux:scenario-proposal 使用指南

> 分析需求文档，同步模板场景，生成端到端测试场景需求 Excel

## 工作流定位

```
QA 场景流程：
  [/sbux:scenario-proposal] → /sbux:scenario-apply → /sbux:scenario-review → /sbux:scenario-import → /sbux:scenario-run
             ↑                                                                                            ↓
         当前位置                                                                         /sbux:log-query

与开发流程并行：
  /sbux:proposal ──→ /sbux:scenario-proposal
     │
     └──→ /sbux:apply → /sbux:review → /sbux:git → /sbux:deploy ──→ /sbux:scenario-run
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 需求文档 | **/sbux:scenario-proposal** | /sbux:scenario-apply |
| MeterSphere 模板场景 | | |

---

## 快速开始

### 前置条件

- /sbux:winit 已配置 MeterSphere
- 准备好需求文档
- MeterSphere 中有模板场景（status=模板示例）

### 基本用法

```bash
/sbux:scenario-proposal /path/to/requirements
```

---

## 最佳实践

1. **选择合适的模板场景** - 模板场景的步骤结构是生成新场景的基础

2. **描述清晰的 test_steps** - 端到端流程的步骤描述要完整

3. **考虑完整业务流程** - 场景测试关注的是跨接口的业务流程

4. **与用例互补** - 场景测试验证流程，用例测试验证单点

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| 需求文档 | 目录中的 .md 文件 | 分析业务流程 |
| 模板场景 | MeterSphere | 同步作为参考 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 场景 Excel | `{folder}/scenarios.xlsx` | 双 Sheet 结构 |

---

## Excel 结构

| Sheet | 内容 |
|-------|------|
| Sheet1 | 场景基本信息（ID、名称、test_steps 等） |
| Sheet2 | 步骤详情（由 sbux:scenario-apply 填充） |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 同步不到模板场景 | 检查 MeterSphere 配置和模块 ID |
| 场景流程不完整 | 需求文档补充业务流程细节 |

---

## 下一步

场景需求生成后：

- 编写场景步骤 → `/sbux:scenario-apply`
