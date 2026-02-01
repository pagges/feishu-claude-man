# /sbux:case-proposal 使用指南

> 分析需求文档，同步现有用例，生成测试用例需求 Excel

## 工作流定位

```
QA 用例流程：
  [/sbux:case-proposal] → /sbux:case-apply → /sbux:case-review → /sbux:case-import → /sbux:case-run
           ↑                                                                              ↓
       当前位置                                                          /sbux:log-query

与开发流程并行：
  /sbux:proposal ──→ /sbux:case-proposal
     │
     └──→ /sbux:apply → /sbux:review → /sbux:git → /sbux:deploy ──→ /sbux:case-run
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 需求文档（可来自 /sbux:proposal） | **/sbux:case-proposal** | /sbux:case-apply |
| MeterSphere 现有用例 | | |

---

## 快速开始

### 前置条件

- /sbux:winit 已配置 MeterSphere
- 准备好需求文档（或 /sbux:proposal 生成的 1-requirements.md）

### 基本用法

```bash
/sbux:case-proposal /path/to/requirements
```

指定包含需求文档的目录。

---

## 最佳实践

1. **参考模板用例** - 同步的模板用例（status=模板示例）展示了标准结构

2. **审核 test_summary** - 这是用例的核心描述，决定后续代码生成质量

3. **确保配置正确** - case-config.yaml 中的模块 ID 和接口信息必须准确

4. **需求文档要完整** - 功能点越清晰，生成的用例覆盖越全面

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| 需求文档 | 目录中的 .md 文件 | 分析功能点 |
| 模板用例 | MeterSphere | 同步作为参考 |
| 配置文件 | case-config.yaml | 模块和接口信息 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 用例 Excel | `{folder}/cases.xlsx` | 包含模板+待实现用例 |

---

## Excel 结构

| 列 | 说明 |
|-----|------|
| A-L | 用例基本信息（ID、名称、优先级等） |
| M-U | 用例代码（由 sbux:case-apply 填充） |
| status | 模板示例 / 待实现 / 待导入 / 已导入 |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 同步不到模板用例 | 检查 MeterSphere 配置和模块 ID |
| 生成的用例不全 | 需求文档补充更多功能点细节 |
| Excel 格式异常 | 确保使用正确的模板 |

---

## 下一步

用例需求生成后：

- 编写用例代码 → `/sbux:case-apply`
