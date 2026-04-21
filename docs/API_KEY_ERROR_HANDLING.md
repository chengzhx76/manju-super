# API Key 错误处理机制说明

## 问题描述
系统偶尔会出现 `API Key missing. Please configure your AntSK API Key.` 错误，这意味着运行时 API Key 丢失或未正确配置。

## 解决方案

### 1. 自定义错误类 (`ApiKeyError`)
在 `geminiService.ts` 中创建了自定义的 `ApiKeyError` 类：

```typescript
export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}
```

### 2. 统一错误抛出
所有 API Key 检查现在都抛出 `ApiKeyError`：

```typescript
const checkApiKey = () => {
  if (!runtimeApiKey) throw new ApiKeyError("API Key missing. Please configure your AntSK API Key.");
  return runtimeApiKey;
};
```

### 3. 全局错误监听器
在 `App.tsx` 中添加了两个全局错误监听器：

- **`error` 事件**：捕获同步代码中的错误
- **`unhandledrejection` 事件**：捕获 Promise 中未处理的拒绝

```typescript
useEffect(() => {
  const handleError = (event: ErrorEvent) => {
    if (event.error?.name === 'ApiKeyError' || 
        event.error?.message?.includes('API Key missing')) {
      console.warn('🔐 检测到 API Key 错误，正在返回登录页...');
      handleClearKey(); // 清除 API Key 并返回登录页
      event.preventDefault();
    }
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (event.reason?.name === 'ApiKeyError' ||
        event.reason?.message?.includes('API Key missing')) {
      console.warn('🔐 检测到 API Key 错误，正在返回登录页...');
      handleClearKey();
      event.preventDefault();
    }
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}, []);
```

## 工作流程

1. **API 调用失败** → `checkApiKey()` 检测到 `runtimeApiKey` 为空
2. **抛出 ApiKeyError** → 自定义错误被抛出
3. **全局捕获** → `window` 的错误监听器捕获到 `ApiKeyError`
4. **自动处理**：
   - 清除 localStorage 中的 API Key
   - 清除内存中的 `apiKey` 和 `runtimeApiKey`
   - 关闭当前项目
   - 自动返回登录页面
   - 阻止默认的错误提示

## 优势

✅ **用户体验友好**：出现 API Key 错误时自动跳转，无需手动刷新

✅ **安全性**：确保无效的 Key 被立即清除

✅ **统一处理**：所有 API Key 相关错误都通过同一机制处理

✅ **防止级联错误**：及时中断操作流程，防止后续 API 调用继续失败

## 触发场景

以下情况会触发自动跳转到登录页：

1. **localStorage 中的 Key 被手动删除**
2. **API Key 过期或失效**（验证失败）
3. **浏览器存储被清空**
4. **多标签页导致状态不同步**
5. **任何导致 `runtimeApiKey` 变为空的情况**
