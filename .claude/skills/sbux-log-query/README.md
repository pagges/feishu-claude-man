# /sbux:log-query 使用指南

> 统一的日志查询入口，支持 ES 日志搜索 + 智能链路追踪

## 工作流定位

```
问题排查辅助工具：

  /sbux:case-run ────┐
                     ├──→ [/sbux:log-query] ──→ 分析日志 ──→ /sbux:fix
  /sbux:scenario-run ┘           ↑
                             当前位置
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| 测试失败的日志需求 | **/sbux:log-query** | 分析结果 → /sbux:fix |
| 关键词、时间范围 | | |

---

## 功能概述

本 skill 合并了原有的日志查询和链路追踪功能：

1. **日志搜索** - 按关键词搜索 ES 日志
2. **智能链路发现** - 从日志中自动检测 Trace ID
3. **链路追踪** - 可选查询完整调用链路（Ingress/Kong/Services）

---

## 快速开始

### 前置条件

- /sbux:winit 已配置日志查询
- 知道要查询的关键词

### 基本用法

```bash
/sbux:log-query
```

### 工作流程

```
1. 输入关键词 → 查询 ES 日志
       ↓
2. 展示日志结果
       ↓
3. 自动检测 Trace ID
       ├─ 未发现 → 结束
       └─ 发现 → 询问"是否查询链路？"
                    ├─ 否 → 结束
                    └─ 是 → 查询链路详情
```

---

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| keyword | 查询关键词（必填，多个用逗号分隔） | - |
| index | ES 索引 | stg:*upp* |
| env | 环境（stg/prod） | 根据 index 推断 |
| days | 查询天数 | 0（今天） |
| size | 返回条数上限 | 100 |

---

## 使用场景

### 场景 1：查询错误日志

```
/sbux:log-query

关键词：ERROR,NullPointerException
索引：stg:*app*
天数：0
条数：100

→ 展示错误日志
→ 如发现 Trace ID，可继续查链路
```

### 场景 2：查询特定请求并追踪链路

```
/sbux:log-query

关键词：orderId123456
索引：stg:*upp*
天数：1
条数：500

→ 展示相关日志
→ 发现 Trace ID: abc-123-def-456
→ 询问是否查询链路
→ 选择"是"
→ 展示 Ingress/Kong/Services 完整链路
```

### 场景 3：排查接口超时

```
/sbux:log-query

关键词：timeout,userId789
索引：prod:*upp*
天数：0

→ 找到超时日志
→ 发现 Trace ID
→ 查看链路各层耗时
→ 定位到慢在 Services 层
```

---

## 链路追踪输出说明

当选择查询链路时，会展示三层信息：

### Ingress 链路
- Host、Method、Path
- Response Code、Duration
- Service Name、Namespace

### Kong 网关
- Request/Response 详情
- Latency（Kong/Proxy/Request）

### Services 服务日志
- 各服务的应用日志
- 日志时间戳和内容

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 查不到日志 | 检查索引名、时间范围是否正确 |
| 结果太多 | 增加关键词缩小范围 |
| 连接失败 | 检查 ES 代理地址配置 |
| 链路查询失败 | 检查 VPN 连接状态 |

---

## 下一步

日志分析后：

- 定位到问题 → `/sbux:fix` 修复
- 需要更详细信息 → 调整关键词重新查询
