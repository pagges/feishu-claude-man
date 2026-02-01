# /sbux:case-import 使用指南

> 将用例从 Excel 批量导入或更新到 MeterSphere 测试平台

## 工作流定位

```
QA 用例流程：
  /sbux:case-proposal → /sbux:case-apply → /sbux:case-review → [/sbux:case-import] → /sbux:case-run
                                                                       ↑                    ↓
                                                                   当前位置  /sbux:log-query
```

| 上游依赖 | 当前 Skill | 下游衔接 |
|----------|-----------|----------|
| /sbux:case-review 通过的用例 | **/sbux:case-import** | /sbux:case-run |
| 或跳过审查的用例 | | |

---

## 快速开始

### 前置条件

- `/sbux:case-apply` 或 `/sbux:case-review` 已完成
- MeterSphere 配置正确
- cases.xlsx 中有待处理的用例

### 基本用法

```bash
# 导入新用例（自动识别 status=待导入 的行）
/sbux:case-import /path/to/cases
用户：导入用例

# 更新已有用例（需要指定编号）
/sbux:case-import /path/to/cases
用户：更新用例 1001,1002,1003
```

---

## 两种模式

### 导入模式（Import）

**触发词**：导入、import、新增、创建

**筛选条件**：`status = 待导入`

**操作**：
1. 调用 MS API 创建用例
2. 回写 case_id、case_uuid
3. 更新 status 为 `已导入`

### 更新模式（Update）

**触发词**：更新、update、修改、同步

**筛选条件**：用户指定的 case_id 编号

**操作**：
1. 检查 case_uuid 是否存在
2. 调用 MS API 更新用例
3. 更新 status 为 `已更新`

---

## 最佳实践

1. **确保配置正确** - MeterSphere 的 URL、Token、模块 ID 必须准确

2. **检查结果** - 操作后确认 Excel 状态已更新

3. **失败用例需排查** - 查看错误信息，修复后重新操作

4. **更新前确保 case_uuid 存在** - 只有已导入的用例才能更新

---

## 输入输出

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| cases.xlsx | /sbux:case-apply | 用例数据 |
| 配置文件 | workflow-config.yaml | MeterSphere 配置 |

### 输出

| 产物 | 位置 | 说明 |
|------|------|------|
| 更新的 Excel | `{folder}/cases.xlsx` | 回写 ID 和状态 |

---

## 状态流转

```
待实现 → (case-apply) → 待导入 → (case-import 导入) → 已导入
                                                          ↓
                                      (修改 Excel) → (case-import 更新) → 已更新
```

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 导入失败 | 检查 MeterSphere Token 和模块 ID |
| 更新失败 | 确认 case_uuid 存在且正确 |
| 部分用例失败 | 查看错误信息，修复后重新操作 |
| ID 未回写 | 检查 Excel 文件是否被占用 |

---

## 下一步

操作完成后：

- 执行用例 → `/sbux:case-run`
