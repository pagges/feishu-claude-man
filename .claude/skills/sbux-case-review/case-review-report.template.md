# 用例审查报告

**输入文件夹**: {input_folder}
**审查时间**: YYYY-MM-DD HH:mm:ss
**审查结果**: ❌ 不通过 / ⚠️ 有警告 / ✅ 通过

---

## 检查汇总

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 需求覆盖 | ✅/⚠️/❌ | 覆盖率 XX% |
| 字段完整 | ✅/⚠️/❌ | X 个缺失/格式错误 |
| 模板一致 | ✅/⚠️/❌ | X 个结构偏离 |
| 断言合理 | ✅/⚠️/❌ | X 个可疑断言 |
| 逻辑正确 | ✅/⚠️/❌ | X 个逻辑错误 |

---

## 🔴 必须修复 (X 个)

| 编号 | 类型 | 问题描述 | 用例编号 |
|------|------|----------|----------|
| E-1 | 字段 | assert_json 格式错误 | #5 |
| E-2 | 字段 | assert_json 缺少 statusCode 断言 | #8 |
| E-3 | 逻辑 | test_summary "orderId 缺失" 但 body 存在 orderId | #12 |

---

## 🟡 建议修复 (X 个)

| 编号 | 类型 | 问题描述 | 用例编号 |
|------|------|----------|----------|
| W-1 | 模板 | headers 结构与模板不一致 | #3 |
| W-2 | 断言 | 异常场景使用成功状态码 | #7 |
| W-3 | 模板 | body 多余字段 "debug" | #15 |

---

## 🔵 参考信息 (X 个)

| 编号 | 类型 | 描述 |
|------|------|------|
| I-1 | 需求 | 测试要点「边界值测试」未被用例覆盖 |
| I-2 | 需求 | 测试要点「并发场景」未被用例覆盖 |

---

## 修复建议

### E-1: assert_json 格式错误

- **用例**: #5 - {test_summary}
- **问题**: JSON 解析失败
- **当前值**: `[{"expression": "$.statusCode", "expect": 100}]`
- **错误**: `expect` 值应为字符串类型
- **建议修复**:
  ```json
  [{"expression": "$.statusCode", "expect": "100", "option": "EQUALS"}]
  ```

### E-2: assert_json 缺少 statusCode 断言

- **用例**: #8 - {test_summary}
- **问题**: 断言中未包含 statusCode 检查
- **当前值**: `[{"expression": "$.data.id", "expect": "123", "option": "EQUALS"}]`
- **建议修复**: 添加 statusCode 断言
  ```json
  [
    {"expression": "$.statusCode", "expect": "100", "option": "EQUALS"},
    {"expression": "$.data.id", "expect": "123", "option": "EQUALS"}
  ]
  ```

### E-3: test_summary 与 body 不一致

- **用例**: #12 - orderId 缺失返回错误
- **问题**: test_summary 描述 orderId 应缺失，但 body 中存在
- **当前 body**: `{"orderId": "123", "amount": 100}`
- **建议修复**: 从 body 中删除 orderId 字段
  ```json
  {"amount": 100}
  ```

---

## 用例详情

### 待审查用例列表

| 编号 | api_uuid | test_summary | 问题数 |
|------|----------|--------------|--------|
| #1 | uuid-1 | 正常下单流程 | 0 |
| #3 | uuid-1 | headers 测试 | 1 (W-1) |
| #5 | uuid-2 | 参数缺失测试 | 1 (E-1) |
| ... | ... | ... | ... |

---

## 下一步

根据审查结果，建议执行以下操作：

1. **修复 ERROR 级别问题**（必须）
2. **考虑修复 WARNING 级别问题**（建议）
3. **完成后重新运行** `/sbux:case-review` 验证
4. **审查通过后运行** `/sbux:case-import` 导入用例
