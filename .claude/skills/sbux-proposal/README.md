# /sbux:proposal 使用指南

> 分析需求，生成完整的提案文档（需求、设计、API、测试用例、任务清单）

## 工作流定位

```
开发流程：
  [/sbux:proposal] → /sbux:apply → /sbux:review → /sbux:git → /sbux:deploy → (/sbux:fix 循环)
      ↑
  当前位置
      │
      ├──→ /sbux:case-proposal (QA 用例)
      └──→ /sbux:scenario-proposal (QA 场景)
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 用户需求描述 | **/sbux:proposal** | /sbux:apply（实现） |
| 项目代码库 | | /sbux:case-proposal（QA 用例） |
| | | /sbux:scenario-proposal（QA 场景） |

---

## 快速开始

### 前置条件

- 工作区干净（无未提交的更改）
- 清晰的需求描述

### 基本用法

```bash
/sbux:proposal 实现用户注册功能，支持邮箱和手机号注册
```

### 常见场景

**新功能开发**
```bash
/sbux:proposal 添加商品收藏功能，用户可以收藏商品并在个人中心查看
```

**技术改造**
```bash
/sbux:proposal 将用户认证从 Session 迁移到 JWT
```

---

## 最佳实践

1. **需求描述越详细越好** - 包含业务场景、预期行为、约束条件，减少后续澄清轮次

2. **批量确认阶段认真审核** - 这是定义需求边界的关键环节，确认后难以大改

3. **选择合适的生成模式**
   - 一次性生成：需求清晰，想快速完成
   - 逐个确认：需要边生成边调整

4. **及时处理 [待确认] 标记** - 所有待确认项必须在 /sbux:apply 前处理完毕

---

## 输出产物

| 产物 | 位置 | 用途 |
|------|------|------|
| 需求文档 | `.proposal/{id}/1-requirements.md` | 定义做什么 |
| 设计文档 | `.proposal/{id}/2-design.md` | 定义怎么做 |
| API 规格 | `.proposal/{id}/3-api-spec.md` | 接口契约 |
| 测试用例 | `.proposal/{id}/4-test-cases.md` | 验收标准 |
| 任务清单 | `.proposal/{id}/5-tasks.md` | 实现计划 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 提案 ID 如何确定 | 自动生成：{序号}-{feature-name} |
| 想修改已生成的文档 | 直接编辑对应的 .md 文件 |
| 工作区有未提交更改 | 先 commit 或 stash 现有更改 |
| 生成的内容不符合预期 | 重新运行 /sbux:proposal，补充更多细节 |

---

## 下一步

提案完成后：

- 开始实现 → `/sbux:apply {proposal-id}`
- 生成 QA 用例 → `/sbux:case-proposal`（将 1-requirements.md 作为输入）
- 生成 QA 场景 → `/sbux:scenario-proposal`
