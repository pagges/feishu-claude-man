# 技术设计：{{FEATURE_NAME}}

> 生成时间: {{TIMESTAMP}}
> 状态: [草稿/已确认]
> 关联需求: [1-requirements.md](./1-requirements.md)
> 项目类型: {{PROJECT_TYPE}}

---

## 1. 设计概述

### 1.1 目标
{{DESIGN_GOAL}}

### 1.2 范围
- 包含: {{IN_SCOPE}}
- 不包含: {{OUT_OF_SCOPE}}

---

## 2. 架构设计

### 2.1 系统架构图

<!--
架构生成规则：
1. 检查 context.json 中的 architecture.detected 字段
2. 如果 detected = true，根据 architecture.layers 生成架构图
3. 如果 detected = false（空项目），可使用推荐架构，但需标注为"推荐架构"
-->

{{ARCHITECTURE_DIAGRAM}}

<!--
空项目时的架构来源说明（二选一）：

【方式 A】使用项目现有架构（architecture.detected = true）:
根据 context.json 中 architecture.layers 的实际分层生成架构图
示例：如果 layers 包含 [controller, service, repository]，则生成：
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Controller │ ──→ │   Service   │ ──→ │  Repository │
└─────────────┘     └─────────────┘     └─────────────┘

【方式 B】空项目推荐架构（architecture.detected = false）:
需在架构图上方标注：「推荐架构 - 可根据项目需求调整」
-->

### 2.2 涉及的组件

| 层级 | 组件 | 职责 | 新建/修改 |
|------|------|------|----------|
| {{LAYER_1}} | {{COMPONENT_1}} | {{RESPONSIBILITY_1}} | {{ACTION_1}} |
| {{LAYER_2}} | {{COMPONENT_2}} | {{RESPONSIBILITY_2}} | {{ACTION_2}} |
| {{LAYER_3}} | {{COMPONENT_3}} | {{RESPONSIBILITY_3}} | {{ACTION_3}} |

---

## 3. 数据模型

### 3.1 核心数据结构

{{DATA_MODEL}}

<!--
数据模型参考：

【后端 - Entity/Model】
// 后端语言对应的实体类定义

【前端 - TypeScript Interface/Type】
interface User {
  id: number;
  email: string;
  createdAt: Date;
}

【前端 - State/Store】
// Zustand/Pinia/Redux 状态定义
-->

### 3.2 请求/响应数据结构

**请求数据**:
{{REQUEST_DATA_STRUCTURE}}

**响应数据**:
{{RESPONSE_DATA_STRUCTURE}}

### 3.3 数据存储设计

{{STORAGE_DESIGN}}

<!--
数据存储参考：

【后端 - 数据库表】
CREATE TABLE xxx (...)

【前端 - LocalStorage/IndexedDB】
Key: "user_preferences"
Value: { theme: "dark", ... }

【前端 - State Store】
store.user = { ... }
-->

---

## 4. 核心流程

### 4.1 主流程

```
1. {{STEP_1}}
   │
   ▼
2. {{STEP_2}}
   │
   ├─ 失败 → {{FAILURE_HANDLING}}
   │
   ▼
3. {{STEP_3}}
   │
   ▼
4. {{STEP_4}}
```

### 4.2 异常/错误处理

| 场景 | 错误类型 | 错误信息 | 处理方式 |
|------|----------|----------|----------|
| {{EXCEPTION_SCENARIO_1}} | {{ERROR_TYPE_1}} | {{ERROR_MSG_1}} | {{HANDLING_1}} |
| {{EXCEPTION_SCENARIO_2}} | {{ERROR_TYPE_2}} | {{ERROR_MSG_2}} | {{HANDLING_2}} |

---

## 5. 关键技术决策

| 决策点 | 备选方案 | 最终决定 | 决策理由 |
|--------|----------|----------|----------|
| {{DECISION_1}} | A/B/C | {{CHOICE_1}} | {{REASON_1}} |
| {{DECISION_2}} | A/B/C | {{CHOICE_2}} | {{REASON_2}} |

---

## 6. 安全考虑

- [ ] 输入校验: {{INPUT_VALIDATION}}
- [ ] 权限控制: {{AUTH_CONTROL}}
- [ ] 敏感数据: {{SENSITIVE_DATA}}

---

## 7. 性能考虑

- [ ] {{PERFORMANCE_ITEM_1}}
- [ ] {{PERFORMANCE_ITEM_2}}
- [ ] {{PERFORMANCE_ITEM_3}}

<!--
性能考虑参考：

【后端】
- 索引设计
- 缓存策略
- 分页处理
- 数据库连接池

【前端】
- 懒加载/代码分割
- 虚拟列表
- 防抖/节流
- 缓存策略 (SWR/React Query)
-->

---

## 8. 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 0.1 | {{TIMESTAMP}} | 初始版本 | AI |
