# API JSON 格式响应优化

## 更新日期
2025-01-03

## 更新内容

### 问题描述
之前调用 `chatCompletion` 时，AI 返回的 JSON 格式不稳定，有时会包含 Markdown 代码块标记（如 \`\`\`json），需要额外的清理步骤。

### 解决方案
为 `chatCompletion` 函数添加 `responseFormat` 参数，当设置为 `'json_object'` 时，API 会强制返回纯 JSON 格式，提高响应的稳定性。

### 技术实现

#### 1. 修改 `chatCompletion` 函数签名

```typescript
const chatCompletion = async (
  prompt: string, 
  model: string = 'gpt-5.1', 
  temperature: number = 0.7, 
  maxTokens: number = 8192, 
  responseFormat?: 'json_object'  // 新增参数
): Promise<string>
```

#### 2. 添加 `response_format` 到请求体

```typescript
const requestBody: any = {
  model: model,
  messages: [{ role: 'user', content: prompt }],
  temperature: temperature,
  max_tokens: maxTokens
};

// 如果指定了响应格式为json_object，添加response_format参数
if (responseFormat === 'json_object') {
  requestBody.response_format = { type: 'json_object' };
}
```

#### 3. 更新所有需要 JSON 响应的调用

以下函数的 `chatCompletion` 调用已添加 `'json_object'` 参数：

1. **`parseScriptToData`** - 剧本解析，返回结构化剧本数据
   ```typescript
   chatCompletion(prompt, model, 0.7, 8192, 'json_object')
   ```

2. **`generateShotList`** - 分镜生成，返回镜头列表
   ```typescript
   chatCompletion(prompt, model, 0.7, 8192, 'json_object')
   ```

3. **`optimizeBothKeyframes`** - 关键帧优化，返回起始帧和结束帧描述
   ```typescript
   chatCompletion(prompt, model, 0.7, 2048, 'json_object')
   ```

4. **`splitShotIntoSubShots`** - 镜头拆分，返回子镜头数组
   ```typescript
   chatCompletion(prompt, model, 0.7, 4096, 'json_object')
   ```

### 保留纯文本响应的函数

以下函数继续使用默认文本格式响应（不添加 `'json_object'` 参数）：

- **`generateVisualPrompts`** - 生成视觉提示词（纯文本）
- **`continueScript`** - AI 续写剧本（纯文本）
- **`rewriteScript`** - AI 改写剧本（纯文本）
- **`optimizeKeyframePrompt`** - 优化单个关键帧提示词（纯文本）
- **`generateActionSuggestion`** - 生成动作建议（纯文本）
- **`enhanceKeyframePrompt`** - 增强关键帧提示词（纯文本）

## 优势

1. **更稳定的 JSON 解析**：避免 Markdown 代码块干扰，减少解析错误
2. **减少后处理**：虽然仍保留 `cleanJsonString` 函数作为兜底，但大多数情况下不再需要
3. **更好的 API 兼容性**：符合 OpenAI API 规范，提高与不同 LLM 提供商的兼容性
4. **类型安全**：明确区分 JSON 响应和文本响应

## 向后兼容性

- ✅ 完全向后兼容
- `responseFormat` 参数为可选参数，默认为 `undefined`（文本格式）
- 现有的纯文本响应函数不受影响

## 测试建议

1. 测试剧本解析是否正常返回 JSON
2. 测试分镜生成是否正常返回 JSON 数组
3. 测试关键帧优化是否正常返回 JSON 对象
4. 测试镜头拆分是否正常返回子镜头数组
5. 确认纯文本功能（续写、改写等）不受影响

## 相关文件

- `services/geminiService.ts` - 主要修改文件

