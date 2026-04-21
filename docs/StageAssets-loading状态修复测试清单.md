# StageAssets Loading状态修复测试清单

## 修复内容

### 问题描述
在场景生成时，如果关闭了页面，再打开后 loading 状态会一直存在，无法重新生成。参考 StageDirector 的实现，现已添加失败状态检测和显示。

### 解决方案
添加了与 StageDirector 相同的卡住状态检测机制，在组件加载时自动将未完成的生成状态重置为失败状态。

## 修改文件列表

### 1. `components/StageAssets/index.tsx`
- ✅ 添加 `useEffect` 钩子检测卡住的生成状态
- ✅ 检测角色、场景和角色变体的卡住状态
- ✅ 自动将 `status === 'generating' && !referenceImage` 的项目重置为 `'failed'`
- ✅ 仅在项目ID变化时执行，避免重复检测

### 2. `components/StageAssets/CharacterCard.tsx`
- ✅ 导入 `AlertCircle` 图标
- ✅ 添加失败状态显示逻辑
- ✅ 显示红色警告图标和"生成失败"文字
- ✅ 添加"重试"按钮，点击可重新生成

### 3. `components/StageAssets/SceneCard.tsx`
- ✅ 导入 `AlertCircle` 图标
- ✅ 更新接口添加 `status` 属性
- ✅ 添加失败状态显示逻辑
- ✅ 显示红色警告图标和"生成失败"文字
- ✅ 添加"重试"按钮，点击可重新生成
- ✅ 区分 loading、失败和初始状态的显示

### 4. `components/StageAssets/WardrobeModal.tsx`
- ✅ 导入 `AlertCircle` 图标
- ✅ 在角色变体卡片中添加失败状态图标显示
- ✅ 添加失败标签显示在缩略图底部
- ✅ 生成按钮在失败时显示"重试"文字并变为红色

## 测试清单

### ✅ 基础功能测试

#### 1. 角色生成失败检测
- [ ] 开始生成角色图片
- [ ] 在生成过程中关闭浏览器标签页
- [ ] 重新打开页面
- [ ] **预期**: 角色卡片显示失败状态（红色警告图标 + "生成失败" + "重试"按钮）
- [ ] 点击"重试"按钮
- [ ] **预期**: 重新开始生成，显示 loading 状态

#### 2. 场景生成失败检测
- [ ] 开始生成场景图片
- [ ] 在生成过程中关闭浏览器标签页
- [ ] 重新打开页面
- [ ] **预期**: 场景卡片显示失败状态（红色警告图标 + "生成失败" + "重试"按钮）
- [ ] 点击"重试"按钮
- [ ] **预期**: 重新开始生成，显示 loading 状态

#### 3. 角色变体生成失败检测
- [ ] 打开某个角色的"服装变体"弹窗
- [ ] 添加一个新的角色变体
- [ ] 开始生成角色变体图片
- [ ] 在生成过程中关闭浏览器标签页
- [ ] 重新打开页面并打开同一角色的"服装变体"弹窗
- [ ] **预期**: 变体缩略图显示失败图标和底部失败标签
- [ ] **预期**: 生成按钮显示"重试"并为红色
- [ ] 点击"重试"按钮
- [ ] **预期**: 重新开始生成

### ✅ 批量生成测试

#### 4. 批量生成中断测试
- [ ] 开始批量生成角色（或场景）
- [ ] 在批量生成过程中（例如生成了 2/5 个）关闭页面
- [ ] 重新打开页面
- [ ] **预期**: 
  - 已完成的项目显示正常（有图片）
  - 正在生成的项目显示失败状态
  - 未开始的项目保持初始状态
- [ ] 可以单独重试失败的项目
- [ ] 可以继续批量生成剩余项目

### ✅ 边界情况测试

#### 5. 切换项目测试
- [ ] 在项目 A 中开始生成
- [ ] 切换到项目 B
- [ ] 再切换回项目 A
- [ ] **预期**: 不触发失败状态重置（因为 useEffect 依赖 project.id）

#### 6. 已有图片的重新生成
- [ ] 选择一个已有图片的角色/场景
- [ ] 点击"重新生成"
- [ ] 在生成过程中关闭页面
- [ ] 重新打开页面
- [ ] **预期**: 
  - 仍然显示原有图片
  - 状态被重置为 'failed'
  - 可以再次点击"重新生成"

#### 7. 正常生成完成
- [ ] 开始生成角色/场景
- [ ] 等待生成完成
- [ ] **预期**: 
  - 显示生成的图片
  - status 变为 'completed'
  - 不会被误判为失败状态

### ✅ UI 显示测试

#### 8. 失败状态 UI 验证
- [ ] 角色卡片：红色 AlertCircle 图标 + "生成失败"文字 + "重试"按钮
- [ ] 场景卡片：红色 AlertCircle 图标 + "生成失败"文字 + "重试"按钮
- [ ] 角色变体：缩略图中红色 AlertCircle + 底部"失败"标签 + 红色"重试"按钮

#### 9. Loading 状态 UI 验证
- [ ] 场景卡片在 loading 时显示旋转的 Loader2 图标 + "生成中..."文字
- [ ] 角色变体在 loading 时缩略图上显示半透明遮罩 + 旋转图标

### ✅ 控制台日志测试

#### 10. 检测日志
- [ ] 打开浏览器开发者工具控制台
- [ ] 在有卡住状态的情况下重新加载页面
- [ ] **预期**: 看到控制台输出 `🔧 检测到卡住的生成状态，正在重置...`

## 实现细节

### 状态检测逻辑
```typescript
useEffect(() => {
  if (!project.scriptData) return;

  // 检查角色和角色变体
  const hasStuckCharacters = project.scriptData.characters.some(char => {
    const isCharStuck = char.status === 'generating' && !char.referenceImage;
    const hasStuckVariations = char.variations?.some(v => 
      v.status === 'generating' && !v.referenceImage
    );
    return isCharStuck || hasStuckVariations;
  });

  // 检查场景
  const hasStuckScenes = project.scriptData.scenes.some(scene => 
    scene.status === 'generating' && !scene.referenceImage
  );

  // 重置卡住的状态
  if (hasStuckCharacters || hasStuckScenes) {
    console.log('🔧 检测到卡住的生成状态，正在重置...');
    // 将 status === 'generating' && !referenceImage 重置为 'failed'
  }
}, [project.id]);
```

### 失败状态判断条件
- `status === 'generating'` - 正在生成中
- `!referenceImage` - 没有生成结果
- 同时满足两个条件 → 重置为 `'failed'`

### 为什么不影响正在生成的项目？
如果生成真正在进行中（API 调用未返回），页面关闭会导致 Promise 被中断，状态停留在 'generating'。重新打开页面时，没有后台进程在继续生成，所以这些项目确实应该被标记为失败。

## 与 StageDirector 的对比

| 特性 | StageDirector | StageAssets（本次修复） |
|------|--------------|----------------------|
| 检测对象 | 关键帧、视频 | 角色、场景、角色变体 |
| 检测条件 | `status === 'generating' && !imageUrl/videoUrl` | `status === 'generating' && !referenceImage` |
| 重置目标 | `'failed'` | `'failed'` |
| 触发时机 | `useEffect(..., [project.id])` | `useEffect(..., [project.id])` |
| 失败 UI | 红色文字 + 重试按钮 | 红色图标 + 文字 + 重试按钮 |

## 已知限制

1. **依赖项目ID**: 只有在切换项目或首次加载时才会检测卡住状态
   - 解决方案：这是预期行为，避免在同一项目中重复执行
   
2. **无法恢复生成进度**: 失败后需要完全重新生成
   - 这是合理的，因为后端 API 调用已经失败

3. **浏览器崩溃vs正常关闭**: 两种情况都会被重置为失败
   - 这是预期行为，因为无法区分两种情况

## 补充说明

### 相关文档
- [StageAssets-loading状态持久化修复.md](./StageAssets-loading状态持久化修复.md) - 之前修复的 loading 状态持久化问题
- [loading状态持久化修复.md](./loading状态持久化修复.md) - StageDirector 的 loading 状态修复

### 下一步建议
1. 考虑添加自动重试机制（可选）
2. 添加失败原因记录（如果 API 返回错误信息）
3. 统计失败次数，避免无限重试

## 测试完成标记

- [ ] 所有基础功能测试通过
- [ ] 所有批量生成测试通过
- [ ] 所有边界情况测试通过
- [ ] 所有 UI 显示测试通过
- [ ] 控制台日志验证通过

**测试人员**: ___________  
**测试日期**: ___________  
**版本**: ___________
