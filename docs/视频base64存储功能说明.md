# 视频Base64存储功能说明

## 问题背景

系统生成的视频在IndexedDB中存储的是URL链接。这些URL链接会有过期时间，导致用户重新打开项目时视频无法播放。

**注**：图片资源（角色参考图、场景参考图、关键帧）从一开始就使用Base64格式存储，不存在过期问题。本次优化主要针对视频资源。

## 解决方案

将视频URL转换为Base64格式后再存储到IndexedDB，实现永久保存。使所有媒体资源（图片和视频）统一使用Base64格式存储。

## 实现细节

### 1. 核心转换函数（geminiService.ts）

新增 `convertVideoUrlToBase64` 函数：

```typescript
const convertVideoUrlToBase64 = async (url: string): Promise<string> => {
  // 下载视频文件
  const response = await fetch(url);
  const blob = await response.blob();
  
  // 转换为base64
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('转换失败'));
    reader.readAsDataURL(blob);
  });
};
```

### 2. 修改视频生成函数（geminiService.ts）

`generateVideo` 函数现在会自动将API返回的视频URL转换为Base64：

```typescript
export const generateVideo = async (...): Promise<string> => {
  // ... 生成视频，获取videoUrl ...
  
  // 将URL转换为base64存储
  const videoBase64 = await convertVideoUrlToBase64(videoUrl);
  return videoBase64; // 返回base64而非URL
}
```

**降级处理**：如果转换失败，会返回原始URL作为备用方案。

### 3. 更新导出功能（exportService.ts）

修改 `downloadFile` 函数，使其同时支持URL和Base64两种格式：

```typescript
async function downloadFile(urlOrBase64: string): Promise<Blob> {
  // 检测并处理base64格式
  if (urlOrBase64.startsWith('data:video/')) {
    const base64Data = urlOrBase64.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'video/mp4' });
  }
  
  // 处理普通URL
  const response = await fetch(urlOrBase64);
  return await response.blob();
}
```

## 数据结构更新（types.ts）

更新所有图片和视频字段的注释，明确说明使用base64格式：

```typescript
export interface CharacterVariation {
  referenceImage?: string; // 角色变体参考图，存储为base64格式（data:image/png;base64,...）
}

export interface Character {
  referenceImage?: string; // 角色基础参考图，存储为base64格式（data:image/png;base64,...）
}

export interface Scene {
  referenceImage?: string; // 场景参考图，存储为base64格式（data:image/png;base64,...）
}

export interface Keyframe {
  imageUrl?: string; // 关键帧图像，存储为base64格式（data:image/png;base64,...）
}

export interface VideoInterval {
  videoUrl?: string; // 视频数据，存储为base64格式（data:video/mp4;base64,...），避免URL过期问题
}
```

## 兼容性说明

### 向后兼容
- 代码同时支持URL和Base64两种格式
- 旧项目中的URL格式视频仍可正常播放和导出
- 新生成的视频会自动使用Base64格式

### 前端显示
- HTML5 `<video>` 标签原生支持Base64 data URL
- 无需修改任何前端显示代码
- StageDirector.tsx 和 StageExport.tsx 中的视频预览功能自动兼容

## 优势所有媒体数据（图片+视频）存储在本地数据库，不依赖外部URL
2. **离线可用**：无网络时也能查看所有已生成的资源
3. **无过期问题**：不受API生成的临时URL时效限制
4. **无缝迁移**：视频支持新旧两种格式，平滑过渡
5. **统一管理**：所有媒体资源使用相同的Base64存储方案

## 媒体资源存储总览

| 资源类型 | 字段名 | 存储格式 | 说明 |
|---------|-------|---------|------|
| 角色基础参考图 | Character.referenceImage | Base64 | 从API直接获取base64 |
| 角色变体参考图 | CharacterVariation.referenceImage | Base64 | 从API直接获取base64 |
| 场景参考图 | Scene.referenceImage | Base64 | 从API直接获取base64 |
| 关键帧图像 | Keyframe.imageUrl | Base64 | 从API直接获取base64 |
| 视频片段 | VideoInterval.videoUrl | Base64 | URL→Base64转换 |频
3. **无过期问题**：不受API生成的临时URL时效限制
4. **无缝迁移**：支持新旧两种格式，平滑过渡

## 性能影响

### 存储空间
- Base64编码会增加约33%的数据大小
- 10秒视频约10-20MB（编码后约13-26MB）
- IndexedDB单个数据库限制通常为几百MB到几GB（取决于浏览器）

### 建议
- 对于大量视频项目，建议定期导出备份
- 浏览器会根据可用空间自动管理IndexedDB配额

## 使用示例

### 生成视频（自动转换）

```typescript
// 调用generateVideo会自动返回base64格式
const videoBase64 = await generateVideo(prompt, startImg, endImg, model);

// 直接存储到项目状态
updateShot(shotId, (s) => ({
  ...s,
  interval: { 
    ...s.interval, 
    videoUrl: videoBase64 // 这里是base64字符串
  }
}));
```

### 导出视频（自动兼容）

```typescript
// 导出功能会自动识别格式
await downloadMasterVideo(project);
await downloadSourceAssets(project);
```

## 测试建议

1. 生成新视频，验证Base64存储
2. 关闭浏览器后重新打开项目，验证视频可播放
3. 导出视频ZIP，验证文件完整性
4. 打开包含旧URL格式的项目，验证向后兼容性

## 故障排除

### 视频无法播放
- 检查IndexedDB存储配额
- 查看浏览器控制台错误信息
- 尝试重新生成视频

### 转换失败
- 系统会自动降级到URL格式
- 检查网络连接（需要下载视频进行转换）
- 查看控制台日志了解失败原因

## 相关文件

- `services/geminiService.ts` - 视频生成和转换逻辑
- `services/exportService.ts` - 导出功能，支持两种格式
- `types.ts` - 数据结构定义
- `components/StageDirector.tsx` - 视频生成界面
- `components/StageExport.tsx` - 导出界面
