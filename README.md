# Feishu-Claude Bridge

让 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 与[飞书](https://www.feishu.cn/)双向通信，支持两种运行模式。

## 使用场景

### 场景一：随时掌握技术趋势

在通勤或休息时，通过飞书让 Claude 帮你追踪 GitHub 热门项目、技术动态：

![GitHub 热门项目查询](docs/images/demo.png)

### 场景二：快速了解项目详情

对某个项目感兴趣？直接让 Claude 帮你调研，获取项目介绍、核心特性、技术栈等信息：

![项目详情查询](docs/images/demo1.png)

### 场景三：获取技术架构与安装指南

需要深入了解一个项目？Claude 可以帮你分析技术架构、查看安装方法：

![技术架构分析](docs/images/demo2.png)

---

## 两种模式

本项目支持 **MCP Server** 和 **Agent 服务** 两种模式，根据你的使用场景选择：

| | MCP Server 模式 | Agent 服务模式 |
|------|----------------|---------------|
| **方向** | Claude → 飞书 | 飞书 → Claude |
| **场景** | 在电脑前使用 Claude Code，让它通过飞书通知你或向你提问 | 不在电脑前，通过飞书远程指挥 Claude 执行任务 |
| **运行方式** | Claude Code 的子进程，按需启动 | 独立后台服务，持续运行 |
| **典型用途** | 长任务进度通知、需要人工确认的决策点 | 移动端触发代码修改、远程执行命令 |

### 选择建议

- **选 MCP Server**：你主要在电脑前工作，希望 Claude 在需要时能联系你
- **选 Agent 服务**：你希望随时随地通过手机给 Claude 下达指令

两种模式可以同时使用，共用同一个飞书应用。

---

## 快速开始：Agent 服务

> 已有飞书应用？3 分钟启动，通过飞书直接与 Claude 对话。

```bash
# 1. 克隆并构建
git clone https://github.com/anthropics/feishu-claude-bridge.git
cd feishu-claude-bridge
npm install && npm run build

# 2. 确保已安装并登录 Claude Code CLI
claude login

# 3. 配置飞书凭据
cp .env.agent.example .env.agent
# 编辑 .env.agent，填入 FEISHU_APP_ID 和 FEISHU_APP_SECRET

# 4. 启动 Agent
export $(cat .env.agent | grep -v '^#' | xargs)
npm run agent
```

启动后，在飞书中给机器人发消息即可开始对话。发送 `/help` 查看可用命令。

---

## 快速开始：MCP Server

> 已有飞书应用？配置后 Claude Code 即可通过飞书联系你。

在 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "feishu-bridge": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/feishu-claude-bridge",
      "env": {
        "FEISHU_APP_ID": "<YOUR_APP_ID>",
        "FEISHU_APP_SECRET": "<YOUR_APP_SECRET>",
        "FEISHU_USER_ID": "<YOUR_OPEN_ID>"
      }
    }
  }
}
```

重启 Claude Code 后，输入 `请用 feishu_notify 给我发消息：测试` 验证。

**MCP 工具：**

| 工具 | 说明 |
|------|------|
| `feishu_notify` | 发送飞书通知（不等待回复） |
| `feishu_ask` | 发送问题并等待用户在飞书上回复 |
| `feishu_history` | 查询最近的消息交互历史 |

---

> 还没有飞书应用？请从[第一步：创建飞书自建应用](#第一步创建飞书自建应用)开始。

## 第一步：创建飞书自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)，点击 **创建企业自建应用**
2. 填写应用名称（如 `Claude Bridge`），选择图标，点击创建
3. 进入应用详情页，记录 **App ID** 和 **App Secret**

## 第二步：配置应用权限

进入应用的 **权限管理** 页面，申请以下权限：

| 权限 | 用途 |
|------|------|
| `im:message:send_as_bot` | 以机器人身份发送消息 |
| `im:message.receive_v1` | 接收用户发送的消息事件 |
| `contact:user.id:readonly` | 通过手机号/邮箱查询用户 Open ID |

## 第三步：启用机器人能力 & 事件订阅

1. 进入 **添加应用能力**，开启 **机器人** 能力
2. 进入 **事件订阅** 页面：
   - 订阅方式选择 **使用长连接接收事件**（无需公网 IP）
   - 添加事件：`im.message.receive_v1`（接收消息）

## 第四步：发布应用

1. 进入 **版本管理与发布**，创建一个新版本
2. 设置好可用范围，提交审核并发布
3. 发布后，在飞书中搜索机器人名称，给它发一条消息确认可以找到

## 第五步：获取你的 Open ID

在飞书中给机器人发一条消息后，可以通过以下脚本查询你的 Open ID：

```bash
FEISHU_APP_ID="<YOUR_APP_ID>" \
FEISHU_APP_SECRET="<YOUR_APP_SECRET>" \
npx ts-node --esm -e "
import * as lark from '@larksuiteoapi/node-sdk';
const client = new lark.Client({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });
const res = await client.contact.user.batchGetId({
  params: { user_id_type: 'open_id' },
  data: { mobiles: ['+86你的手机号'] },
});
console.log(JSON.stringify(res?.data, null, 2));
"
```

> 需要应用已开通 `contact:user.id:readonly` 权限。

## 第六步：安装并构建

```bash
git clone https://github.com/anthropics/feishu-claude-bridge.git
cd feishu-claude-bridge
npm install
npm run build
```

## 第七步：配置 Claude Code

你可以选择 **项目级** 或 **全局** 配置。

### 方式 A：项目级配置

在你的工作项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "feishu-bridge": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/feishu-claude-bridge",
      "env": {
        "FEISHU_APP_ID": "<YOUR_APP_ID>",
        "FEISHU_APP_SECRET": "<YOUR_APP_SECRET>",
        "FEISHU_USER_ID": "<YOUR_OPEN_ID>"
      }
    }
  }
}
```

> 建议将 `.mcp.json` 加入 `.gitignore`，避免泄露凭据。

### 方式 B：全局配置（推荐）

在 `~/.claude/` 目录下创建 `settings.json`（如已存在则合并内容）：

```json
{
  "mcpServers": {
    "feishu-bridge": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/feishu-claude-bridge",
      "env": {
        "FEISHU_APP_ID": "<YOUR_APP_ID>",
        "FEISHU_APP_SECRET": "<YOUR_APP_SECRET>",
        "FEISHU_USER_ID": "<YOUR_OPEN_ID>"
      }
    }
  }
}
```

全局配置后，所有项目的 Claude Code 都可以使用飞书通信，无需每个项目单独配置。

## 第八步：验证

重启 Claude Code，然后输入：

```
请用 feishu_notify 给我发一条消息："配置测试成功"
```

如果飞书收到消息，说明配置成功。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FEISHU_APP_ID` | 是 | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | 是 | 飞书应用 App Secret |
| `FEISHU_USER_ID` | 否 | 默认目标用户 Open ID，不填则需在每次调用时传入 `userId` |
| `LOG_LEVEL` | 否 | 日志级别：`debug` / `info` / `warn` / `error`，默认 `info` |

## Agent 服务（主动会话模式）

除了 MCP Server 被动模式外，还提供独立运行的 Agent 服务，支持通过飞书消息主动触发 Claude 执行任务。

### 前置条件

Agent 服务使用本地安装的 `claude` 命令行工具，需要先完成安装和登录：

```bash
# 安装 Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash

# 登录（使用你的 Claude 订阅账号）
claude login
```

> **无需 ANTHROPIC_API_KEY**：Agent 服务直接使用你的 Claude Code 订阅，不需要单独的 API Key。

### 启动 Agent 服务

```bash
# 1. 复制配置示例
cp .env.agent.example .env.agent

# 2. 编辑配置文件，填入飞书凭据
# - FEISHU_APP_ID, FEISHU_APP_SECRET

# 3. 加载环境变量并启动
export $(cat .env.agent | grep -v '^#' | xargs)
npm run agent
```

### Agent 服务功能

启动后，直接在飞书中给机器人发消息即可与 Claude 对话。

**支持的命令：**

| 命令 | 功能 |
|------|------|
| `/new` | 清除会话上下文，开始新对话 |
| `/cancel` | 取消当前正在执行的任务 |
| `/status` | 查看当前会话状态 |
| `/help` | 显示帮助信息 |

**Claude 可执行的操作：**
- 读取和编辑代码文件
- 执行终端命令
- 搜索代码库
- 访问网页信息

### Agent 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AGENT_WORKING_DIR` | 否 | 工作目录，默认当前目录 |
| `AGENT_PERMISSION_MODE` | 否 | 权限模式：`acceptEdits` / `plan` / `bypassPermissions` |
| `AGENT_ALLOWED_USERS` | 否 | 允许使用的用户 Open ID，逗号分隔 |

完整配置选项见 `.env.agent.example`。

### Docker 部署

```bash
# 1. 确保本机已登录 Claude Code
claude login

# 2. 配置环境变量
cp .env.agent.example .env.agent
# 编辑 .env.agent（填入飞书凭据）

# 3. 启动容器（自动挂载 ~/.claude 凭据）
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

> 容器会自动挂载本机的 `~/.claude` 目录以复用 Claude Code 登录凭据。

### Systemd 服务部署（Linux）

```bash
# 1. 运行安装脚本
sudo bash deploy/install.sh

# 2. 按提示完成部署
# 3. 启动服务
sudo systemctl start feishu-claude-agent
```

## 开发

```bash
npm test         # 运行测试
npm run build    # 构建
npm run agent    # 启动 Agent 服务
```

## License

[MIT](LICENSE)
