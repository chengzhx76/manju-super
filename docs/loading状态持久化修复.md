# 导演工作台Loading状态持久化修复

## 问题描述

在导演工作台生成图片或视频时，如果切换了左边的菜单，再切换回来loading状态就消失了，并且不能继续看到生成进度。

## 问题原因

1. **组件本地状态**：`processingTasks`状态存储在`StageDirector`组件的React state中
2. **组件生命周期**：当用户切换菜单时，`StageDirector`组件被卸载
3. **状态丢失**：组件重新挂载时，`processingTasks`状态被重置为空数组
4. **后台继续运行**：API调用仍在后台继续执行，但UI上看不到进度

## 解决方案

**使用数据模型中的status字段来持久化loading状态**

### 修改内容

1. **移除本地状态**
   - 删除`processingTasks` React state
   - 改用`Keyframe`和`VideoInterval`的`status`字段

2. **生成图片时的状态管理**
   ```tsx
   // 开始生成前设置status为'generating'
   updateProject((prevProject: ProjectState) => ({
     ...prevProject,
     shots: prevProject.shots.map(s => {
       if (s.id !== shot.id) return s;
       const newKeyframes = [...(s.keyframes || [])];
       // 设置keyframe status为'generating'
       const generatingKf: Keyframe = {
         id: kfId,
         type,
         visualPrompt: prompt,
         status: 'generating'
       };
       // ... 更新keyframes数组
     })
   }));
   
   // 生成成功后设置为'completed'
   // 生成失败后设置为'failed'
   ```

3. **生成视频时的状态管理**
   ```tsx
   // 开始生成前设置interval status为'generating'
   updateShot(shot.id, (s) => ({
     ...s,
     interval: s.interval ? { ...s.interval, status: 'generating' } : {
       // 创建新的interval对象，status为'generating'
     }
   }));
   ```

4. **UI显示loading状态**
   ```tsx
   {/* 根据keyframe的status显示loading */}
   {startKf?.status === 'generating' && (
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
       <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
     </div>
   )}
   
   {/* 根据interval的status禁用按钮 */}
   disabled={!startKf?.imageUrl || activeShot.interval?.status === 'generating'}
   ```

### 状态流转

**图片生成（Keyframe）**
```
pending → generating → completed/failed
```

**视频生成（VideoInterval）**
```
pending → generating → completed/failed
```

## 优点

1. ✅ **状态持久化**：status字段存储在ProjectState中，会自动保存到IndexedDB
2. ✅ **切换页面不影响**：即使切换到其他菜单再切换回来，loading状态依然显示
3. ✅ **数据一致性**：状态与实际生成进度保持同步
4. ✅ **错误处理**：失败时设置status为'failed'，便于用户了解失败状态
5. ✅ **简化代码**：移除了本地状态管理，代码更简洁

## 注意事项

1. **错误恢复**：如果用户在生成过程中刷新页面，status会保持'generating'状态。未来可以添加检测机制来重置这些"僵尸"状态
2. **并发控制**：多个镜头可以同时处于'generating'状态
3. **数据库存储**：每次状态更新都会触发IndexedDB保存

## 测试清单

- [x] 生成图片时切换菜单，loading状态保持
- [x] 生成视频时切换菜单，loading状态保持
- [x] 生成成功后status正确更新为'completed'
- [x] 生成失败后status正确更新为'failed'
- [x] 按钮在生成过程中正确禁用
- [x] 多个镜头同时生成时互不干扰

## 相关文件

- `components/StageDirector.tsx` - 主要修改文件
- `types.ts` - 使用了Keyframe和VideoInterval的status字段
- `services/storageService.ts` - 自动持久化ProjectState
