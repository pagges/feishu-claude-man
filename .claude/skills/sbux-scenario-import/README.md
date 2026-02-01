# /sbux:scenario-import 使用指南

> 将场景从 Excel 批量导入或更新到 MeterSphere 测试平台

## 工作流定位

```
QA 场景流程：
  /sbux:scenario-proposal → /sbux:scenario-apply → /sbux:scenario-review → [/sbux:scenario-import] → /sbux:scenario-run
                                                                                   ↑                        ↓
                                                                               当前位置       /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:scenario-review 通过的场景 | **/sbux:scenario-import** | /sbux:scenario-run |
| 或跳过审查的场景 | | |

---

## 快速开始

### 前置条件

- `/sbux:scenario-apply` 或 `/sbux:scenario-review` 已完成
- MeterSphere 配置正确
- scenarios.xlsx 中有待处理的场景

### 基本用法

```bash
# 导入新场景（自动识别 status=待导入 的行）
/sbux:scenario-import /path/to/scenarios
用户：导入场景

# 更新已有场景（需要指定编号）
/sbux:scenario-import /path/to/scenarios
用户：更新场景 TC001,TC002,TC003
```

---

## 两种模式

### 导入模式（Import）

**触发词**：导入、import、新增、创建

**筛选条件**：`status = 待导入`

**操作**：
1. 调用 MS API 创建场景
2. 回写 scenario_id、scenario_uuid
3. 更新 status 为 `已导入`

### 更新模式（Update）

**触发词**：更新、update、修改、同步

**筛选条件**：用户指定的 case_num 编号

**操作**：
1. 检查 scenario_uuid 是否存在
2. 调用 MS API 更新场景
3. 更新 status 为 `已更新`

---

## 最佳实践

1. **确保模块映射正确** - 场景导入/更新的目标模块必须存在

2. **检查结果** - 操作后确认 Excel 状态已更新

3. **失败场景需排查** - 查看错误信息，修复后重新操作

4. **更新前确保 scenario_uuid 存在** - 只有已导入的场景才能更新

5. **同步修改 Sheet2** - 如果需要更新步骤详情，记得同时修改 Sheet2

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| scenarios.xlsx | /sbux:scenario-apply | 场景数据 |
| 配置文件 | workflow-config.yaml | MeterSphere 配置 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 更新的 Excel | `{folder}/scenarios.xlsx` | 回写 ID 和状态 |

---

## 状态流转

```
待实现 → (scenario-apply) → 待导入 → (scenario-import 导入) → 已导入
                                                                   ↓
                                         (修改 Excel) → (scenario-import 更新) → 已更新
```

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 导入失败 | 检查 MeterSphere Token 和模块 ID |
| 更新失败 | 确认 scenario_uuid 存在且正确 |
| 部分场景失败 | 查看错误信息，修复后重新操作 |
| 步骤未更新 | 确保 Sheet2 中 case_num 与 Sheet1 匹配 |

---

## 下一步

操作完成后：

- 执行场景 → `/sbux:scenario-run`
