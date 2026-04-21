# AI增强提示词功能说明

## 📋 概述

将关键帧提示词生成从**固定模板**改为**可选的AI动态生成**,提供更灵活和专业的视觉描述。

## 🎯 主要改动

### 1. 简化基础模板 (`components/StageDirector/utils.ts`)

**之前**: `buildKeyframePrompt` 包含大量固定的技术规格和视觉细节(约80行)
- ❌ 固定的技术规格(画面比例、分辨率等)
- ❌ 固定的视觉细节(光影层次、色彩饱和度等)
- ❌ 固定的角色要求、环境要求、氛围营造等

**现在**: 简化为轻量级基础模板(约20行)
- ✅ 保留核心的视觉风格、镜头运动、构图指导
- ✅ 移除冗长的固定描述

### 2. 新增AI增强函数 

#### `utils.ts` - `buildKeyframePromptWithAI`
```typescript
export const buildKeyframePromptWithAI = async (
  basePrompt: string,
  visualStyle: string,
  cameraMovement: string,
  frameType: 'start' | 'end',
  enhanceWithAI: boolean = true
): Promise<string>
```
- 先构建基础提示词
- 如果开启AI增强,调用LLM动态生成详细规格
- 失败时自动降级到基础提示词

#### `geminiService.ts` - `enhanceKeyframePrompt`
```typescript
export const enhanceKeyframePrompt = async (
  basePrompt: string,
  visualStyle: string,
  cameraMovement: string,
  frameType: 'start' | 'end',
  model: string = 'gpt-5.1'
): Promise<string>
```
- 调用LLM生成以下专业内容:
  - **技术规格**: 画面比例、分辨率、镜头语言、景深
  - **视觉细节**: 光影层次、色彩饱和度、材质质感、大气效果
  - **角色要求**: 面部表情、肢体语言、服装细节、毛发细节
  - **环境要求**: 背景层次、空间透视、环境光影
  - **氛围营造**: 情绪基调、色彩心理、视觉节奏
  - **质量保证**: 主体清晰、背景过渡、光影一致等

### 3. UI控制开关 (`components/StageDirector/index.tsx`)

在导演工作台工具栏添加AI增强开关:

```tsx
const [useAIEnhancement, setUseAIEnhancement] = useState(true);
```

**界面位置**: 导演工作台顶部工具栏,左侧标题和右侧进度之间

**控件样式**:
- 复选框控件
- Sparkles图标(根据状态改变颜色)
- 标签文字: "AI增强提示词"

## 🔄 工作流程

### 基础模式 (AI增强关闭)
```
用户点击生成关键帧
  ↓
buildKeyframePrompt (简化模板)
  ↓
直接调用图像生成API
```

### AI增强模式 (AI增强开启,默认)
```
用户点击生成关键帧
  ↓
buildKeyframePrompt (简化模板)
  ↓
enhanceKeyframePrompt (LLM动态生成详细规格)
  ↓
组合基础+增强内容
  ↓
调用图像生成API
```

### 容错机制
- AI增强失败时自动降级到基础模板
- 不影响用户体验
- 控制台会记录失败信息

## 💡 优势

### 之前 (固定模板)
- ❌ 所有镜头使用相同的技术描述
- ❌ 无法根据具体场景灵活调整
- ❌ 提示词冗长但不够精准
- ❌ 代码维护困难(80行字符串)

### 现在 (AI动态生成)
- ✅ 根据每个镜头的实际情况定制描述
- ✅ LLM理解场景上下文并生成适配的技术规格
- ✅ 用户可选择是否使用AI增强
- ✅ 代码更简洁,更易维护
- ✅ 生成质量更高,更专业

## 📊 性能考虑

- **额外耗时**: 每次AI增强约需1-3秒(取决于模型响应速度)
- **API调用**: 每个关键帧额外调用1次LLM API
- **Token消耗**: 约1000-2000 tokens/次增强
- **可关闭**: 用户可随时关闭AI增强以节省时间和成本

## 🎨 使用建议

### 建议开启AI增强的场景:
- 复杂的电影级镜头
- 需要精细视觉控制的场景
- 重要的关键镜头

### 建议关闭AI增强的场景:
- 快速预览和测试
- 简单的镜头
- API配额有限时
- 需要快速生成大量镜头时

## 🔧 技术细节

### 文件修改列表:
1. `components/StageDirector/utils.ts`
   - 简化 `buildKeyframePrompt`
   - 新增 `buildKeyframePromptWithAI`

2. `services/geminiService.ts`
   - 新增 `enhanceKeyframePrompt`

3. `components/StageDirector/index.tsx`
   - 新增 `useAIEnhancement` 状态
   - 修改 `handleGenerateKeyframe` 逻辑
   - 添加UI控制开关

### 依赖关系:
```
index.tsx
  ↓ 调用
utils.ts → buildKeyframePromptWithAI
  ↓ 调用
geminiService.ts → enhanceKeyframePrompt
  ↓ 调用
chatCompletion (已有的LLM接口)
```

## 🚀 后续优化方向

1. **缓存机制**: 相似镜头可复用增强结果
2. **批量增强**: 批量生成时优化API调用
3. **增强程度**: 添加"轻度/中度/重度"增强级别
4. **自定义模板**: 允许用户保存和复用自己的增强模板
5. **A/B对比**: 提供基础vs增强的效果对比功能

## 📝 更新日志

- **2025-12-20**: 初始实现AI增强提示词功能
  - 简化基础模板
  - 添加AI增强函数
  - 添加UI控制开关
  - 实现容错机制
