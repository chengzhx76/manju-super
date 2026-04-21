# Render Logs 功能说明

## 概述
Render Logs 是一个完整的API调用追踪系统，记录每次真实的模型调用，包括成功和失败的请求。

## 核心特性

### 1. 真实的历史记录
- ✅ 记录每次API调用（不是资源快照）
- ✅ 包含真实的时间戳
- ✅ 记录成功和失败的尝试
- ✅ 持久化存储，不会因删除资源而丢失

### 2. 详细的日志信息
每条日志包含：
- **类型** (type): character, scene, keyframe, video, script-parsing
- **资源ID** (resourceId): 关联的资源标识
- **资源名称** (resourceName): 人类可读的描述
- **状态** (status): success 或 failed
- **模型** (model): 使用的AI模型（imagen-3, veo_3_1等）
- **时间戳** (timestamp): 真实的调用时间
- **耗时** (duration): 请求执行时间（毫秒）
- **错误信息** (error): 失败时的错误详情（可选）
- **提示词** (prompt): 使用的提示词（可选，用于调试）

### 3. Token追踪（预留）
数据结构已支持token统计：
- inputTokens: 输入token数量
- outputTokens: 输出token数量  
- totalTokens: 总token使用量

> 注：当前版本token数据为预留字段，需要从API响应中解析实际使用量

## 技术实现

### 数据结构
```typescript
export interface RenderLog {
  id: string;
  timestamp: number;
  type: 'character' | 'character-variation' | 'scene' | 'keyframe' | 'video' | 'script-parsing';
  resourceId: string;
  resourceName: string;
  status: 'success' | 'failed';
  model: string;
  prompt?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  duration?: number;
}
```

### 核心服务

#### renderLogService.ts
提供日志记录功能：
- `setLogCallback(callback)`: 设置日志保存回调
- `addRenderLog(log)`: 添加日志记录
- `addRenderLogWithTokens(log)`: 添加包含token信息的日志
- `withLogging(operation, logInfo)`: 包装异步操作自动记录

#### 集成方式
1. **App.tsx** - 在useEffect中设置日志回调，自动将日志保存到project.renderLogs
2. **geminiService.ts** - 在API调用处添加日志记录（已实现generateImage）
3. **StageExport.tsx** - 显示日志历史

## 使用示例

### 在API函数中添加日志
```typescript
import { addRenderLogWithTokens } from './renderLogService';

export const generateImage = async (prompt: string): Promise<string> => {
  const startTime = Date.now();
  
  try {
    // API调用
    const result = await callImageAPI(prompt);
    
    // 记录成功
    addRenderLogWithTokens({
      type: 'keyframe',
      resourceId: 'img-xxx',
      resourceName: prompt.substring(0, 50),
      status: 'success',
      model: 'imagen-3',
      duration: Date.now() - startTime
    });
    
    return result;
  } catch (error) {
    // 记录失败
    addRenderLogWithTokens({
      type: 'keyframe',
      resourceId: 'img-xxx',
      resourceName: prompt.substring(0, 50),
      status: 'failed',
      model: 'imagen-3',
      error: error.message,
      duration: Date.now() - startTime
    });
    
    throw error;
  }
};
```

### 查看日志
在导出页面点击 "Render Logs" 卡片即可查看所有API调用历史。

## 后续改进计划

1. **完善token统计** - 从API响应中提取真实的token使用量
2. **成本计算** - 基于token使用量计算准确的API成本
3. **更多API集成** - 为所有API调用添加日志（generateVideo, parseScript等）
4. **日志导出** - 支持导出日志为CSV/JSON用于分析
5. **日志过滤和搜索** - 按类型、状态、时间范围筛选
6. **统计图表** - 可视化展示调用趋势和成本分析

## 数据迁移

旧项目会自动迁移：
- 加载项目时自动添加空的 `renderLogs: []` 字段
- 不影响现有功能
- 从新的API调用开始记录日志
