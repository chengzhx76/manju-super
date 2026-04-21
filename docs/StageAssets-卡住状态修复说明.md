# StageAssets 卡住状态修复说明

## 问题
在场景生成时，如果关闭了页面，再打开后 loading 状态会一直存在，无法重新生成。

## 解决方案
参考 StageDirector 的实现，添加了组件加载时的卡住状态检测和自动重置功能。

## 主要修改

### 1. 添加状态检测 Hook（index.tsx）
```typescript
useEffect(() => {
  // 检测角色、场景、角色变体的卡住状态
  // 如果 status === 'generating' 但没有 referenceImage
  // 自动重置为 'failed'
}, [project.id]);
```

### 2. 添加失败状态 UI 显示
- **CharacterCard**: 显示红色警告图标 + "生成失败" + "重试"按钮
- **SceneCard**: 显示红色警告图标 + "生成失败" + "重试"按钮  
- **WardrobeModal**: 变体缩略图显示失败图标和标签，按钮变为红色"重试"

## 工作原理

1. **页面关闭时**: 
   - 生成状态 (`status: 'generating'`) 被保存到 localStorage
   - API 调用被中断，没有生成结果

2. **页面重新打开时**:
   - useEffect 检测到 `status === 'generating' && !referenceImage`
   - 自动将状态重置为 `'failed'`
   - UI 显示失败状态和重试按钮

3. **点击重试**:
   - 重新调用生成函数
   - 状态变为 `'generating'`
   - 正常生成流程

## 影响范围

✅ 角色基础外观生成  
✅ 角色服装变体生成  
✅ 场景图片生成  
✅ 批量生成中断恢复  

## 测试要点

1. 生成过程中关闭页面 → 重新打开应显示失败状态
2. 点击重试按钮 → 应能正常重新生成
3. 已有图片的项目重新生成失败 → 原图片保留，可重试
4. 控制台应输出检测日志

## 相关文件

- [components/StageAssets/index.tsx](../components/StageAssets/index.tsx)
- [components/StageAssets/CharacterCard.tsx](../components/StageAssets/CharacterCard.tsx)
- [components/StageAssets/SceneCard.tsx](../components/StageAssets/SceneCard.tsx)
- [components/StageAssets/WardrobeModal.tsx](../components/StageAssets/WardrobeModal.tsx)

## 参考

本修复参考了 [StageDirector/index.tsx](../components/StageDirector/index.tsx) 中的相同机制（第 54-77 行）。
