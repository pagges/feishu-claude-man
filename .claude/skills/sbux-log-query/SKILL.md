---
name: sbux:log-query
description: 查询 ES 日志并智能发现链路。触发词：log-query、日志查询、查日志、trace、链路查询。
---

# ES 日志查询（含链路追踪）

## 功能说明

统一的日志查询入口，支持：
1. **日志搜索** - 按关键词搜索 ES 日志
2. **链路追踪** - 从日志中发现 Trace ID，可继续查询完整调用链路

## Step 1: 读取配置文件

尝试读取当前目录下的 `workflow-config.yaml` 配置文件：

- **存在**：提取 `log_query` 配置作为默认值
- **不存在**：使用下方硬编码默认值

**硬编码默认值**（配置文件不存在时使用）：
- base_url: `http://arex.stg.sbuxcf.net/repeaterApi`
- default_index: `stg:*upp*`
- default_days: `0`
- default_size: `100`

## Step 2: 参数收集

使用 AskUserQuestion 工具**一次性询问用户所有参数**：

1. **keyword** - 查询关键词（必填，多个用逗号分隔，OR 逻辑匹配）
2. **index** - ES 索引
   - 如果配置文件中有 `log_query.indexes`，则作为选项列表供用户选择
   - 默认值为配置文件中的 `log_query.default_index`，或 `stg:*upp*`
3. **env** - 查询环境
   - 枚举值：`stg` / `prod`
   - 根据 index 智能推断：index 包含 `stg` 则默认 `stg`，包含 `prod` 则默认 `prod`
4. **days** - 查询天数
   - 默认值为配置文件中的 `log_query.default_days`，或 `0`
   - 枚举值：`0`（今天）/ `1` / `7` / `30`
5. **size** - 返回条数上限
   - 默认值为配置文件中的 `log_query.default_size`，或 `100`
   - 枚举值：`100` / `500` / `1000`
6. **base_url** - ES 代理地址
   - 默认值为配置文件中的 `log_query.base_url`，或 `http://arex.stg.sbuxcf.net/repeaterApi`

## Step 3: 执行日志查询

```bash
python3 scripts/log-query.py \
  --keyword <keyword> \
  --index <index> \
  --days <days> \
  --size <size> \
  --base_url <base_url>
```

日志内容输出到 stdout，错误信息输出到 stderr。

展示查询结果给用户。

## Step 4: Trace ID 检测

从日志查询结果中使用正则表达式提取 Trace ID：

**匹配规则**：UUID 格式 `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`

**处理逻辑**：
1. 提取所有匹配的 UUID
2. 去重
3. 如果**未发现任何 Trace ID** → 结束，不进入 Step 5

## Step 5: 询问是否查询链路（仅当发现 Trace ID 时执行）

使用 AskUserQuestion 询问用户：

**问题**："发现 {N} 个 Trace ID，是否需要查询链路调用情况？"

**选项**：
- `是` - 继续查询链路
- `否` - 结束

**如果用户选择"否"** → 结束

**如果用户选择"是"且发现多个 Trace ID**：
- 让用户选择要查询的 Trace ID（提供选项列表）
- 可以选择单个或"全部"

## Step 6: 执行链路查询（仅当用户选择查询链路时执行）

使用 Step 2 中收集的 `env` 和 `days` 参数，执行链路查询：

```bash
python3 scripts/trace-query.py \
  --trace_id <选中的trace_id> \
  --env <env> \
  --days <days>
```

### 结果解读

脚本会输出格式化的查询结果，包含三个部分：

**Ingress 链路**
- host: 域名
- method: HTTP 方法
- path: 请求路径
- response_code: 响应状态码
- duration: 耗时（秒）
- service_name: 服务名称
- namespace: 命名空间

**Kong 网关日志**
- host: 域名
- latencies: 延迟信息（kong/proxy/request）
- request: 请求详情
- response: 响应详情

**Services 服务日志**
- host: 域名
- index: ES 索引
- logs: 日志详情列表
