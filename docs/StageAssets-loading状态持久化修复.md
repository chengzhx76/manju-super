# StageAssets Loading状态持久化修复

## 问题描述

在**角色与场景(StageAssets)**页面生成图片时,如果切换了左边的菜单,再切换回来loading状态就消失了,并且不能继续看到生成进度。

这个问题与之前修复的**StageDirector** loading状态持久化问题类似。

## 问题原因

1. **组件本地状态**: `generatingIds` (Set<string>) 状态存储在 `StageAssets` 组件的 React state 中
2. **组件生命周期**: 当用户切换菜单时, `StageAssets` 组件被卸载
3. **状态丢失**: 组件重新挂载时, `generatingIds` 状态被重置为空Set
4. **后台继续运行**: API调用仍在后台继续执行,但UI上看不到进度

## 解决方案

**使用数据模型中的status字段来持久化loading状态**

### 1. 数据模型修改 (types.ts)

为 `Character`, `Scene`, 和 `CharacterVariation` 接口添加 `status` 字段:

```typescript
export interface CharacterVariation {
  id: string;
  name: string;
  visualPrompt: string;
  negativePrompt?: string;
  referenceImage?: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed'; // ✅ 新增
}

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: string;
  personality: string;
  visualPrompt?: string;
  negativePrompt?: string;
  coreFeatures?: string;
  referenceImage?: string;
  variations: CharacterVariation[];
  status?: 'pending' | 'generating' | 'completed' | 'failed'; // ✅ 新增
}

export interface Scene {
  id: string;
  location: string;
  time: string;
  atmosphere: string;
  visualPrompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed'; // ✅ 新增
}
```

### 2. 组件修改 (components/StageAssets/index.tsx)

#### 移除本地状态

```typescript
// ❌ 移除
const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

// ✅ 改为直接使用数据模型的 status 字段
```

#### 修改生成函数

**handleGenerateAsset** (角色/场景生成):

```typescript
const handleGenerateAsset = async (type: 'character' | 'scene', id: string) => {
  // ✅ 开始生成前设置 status 为 'generating'
  if (project.scriptData) {
    const newData = { ...project.scriptData };
    if (type === 'character') {
      const c = newData.characters.find(c => compareIds(c.id, id));
      if (c) c.status = 'generating';
    } else {
      const s = newData.scenes.find(s => compareIds(s.id, id));
      if (s) s.status = 'generating';
    }
    updateProject({ scriptData: newData });
  }

  try {
    // ... 生成逻辑 ...
    
    // ✅ 成功后设置为 'completed'
    if (project.scriptData) {
      const newData = { ...project.scriptData };
      if (type === 'character') {
        const c = newData.characters.find(c => compareIds(c.id, id));
        if (c) {
          c.referenceImage = imageUrl;
          c.status = 'completed';
        }
      } else {
        const s = newData.scenes.find(s => compareIds(s.id, id));
        if (s) {
          s.referenceImage = imageUrl;
          s.status = 'completed';
        }
      }
      updateProject({ scriptData: newData });
    }

  } catch (e: any) {
    // ✅ 失败后设置为 'failed'
    if (project.scriptData) {
      const newData = { ...project.scriptData };
      if (type === 'character') {
        const c = newData.characters.find(c => compareIds(c.id, id));
        if (c) c.status = 'failed';
      } else {
        const s = newData.scenes.find(s => compareIds(s.id, id));
        if (s) s.status = 'failed';
      }
      updateProject({ scriptData: newData });
    }
  }
};
```

**handleGenerateVariation** (角色变体生成):

```typescript
const handleGenerateVariation = async (charId: string, varId: string) => {
  // ✅ 设置生成状态
  if (project.scriptData) {
    const newData = { ...project.scriptData };
    const c = newData.characters.find(c => compareIds(c.id, charId));
    const v = c?.variations?.find(v => compareIds(v.id, varId));
    if (v) v.status = 'generating';
    updateProject({ scriptData: newData });
  }

  try {
    // ... 生成逻辑 ...
    
    // ✅ 成功后设置 'completed'
    const v = c?.variations?.find(v => compareIds(v.id, varId));
    if (v) {
      v.referenceImage = imageUrl;
      v.status = 'completed';
    }

  } catch (e: any) {
    // ✅ 失败后设置 'failed'
    if (project.scriptData) {
      const newData = { ...project.scriptData };
      const c = newData.characters.find(c => compareIds(c.id, charId));
      const v = c?.variations?.find(v => compareIds(v.id, varId));
      if (v) v.status = 'failed';
      updateProject({ scriptData: newData });
    }
  }
};
```

#### 修改UI渲染逻辑

```typescript
// ❌ 旧代码
isGenerating={generatingIds.has(char.id)}
isGenerating={generatingIds.has(scene.id)}

// ✅ 新代码
isGenerating={char.status === 'generating'}
isGenerating={scene.status === 'generating'}
```

### 3. 子组件修改 (WardrobeModal.tsx)

#### 移除 generatingIds prop

```typescript
// ❌ 旧接口
interface WardrobeModalProps {
  character: Character;
  generatingIds: Set<string>; // 删除此行
  onClose: () => void;
  // ...
}

// ✅ 新接口
interface WardrobeModalProps {
  character: Character;
  onClose: () => void;
  // ...
}
```

#### 使用 variation.status

```typescript
// ❌ 旧代码
{generatingIds.has(variation.id) && (
  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
    <Loader2 className="w-4 h-4 text-white animate-spin" />
  </div>
)}

<button 
  disabled={generatingIds.has(variation.id)}
>
  <RefreshCw className={`w-3 h-3 ${generatingIds.has(variation.id) ? 'animate-spin' : ''}`} />
</button>

// ✅ 新代码
{variation.status === 'generating' && (
  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
    <Loader2 className="w-4 h-4 text-white animate-spin" />
  </div>
)}

<button 
  disabled={variation.status === 'generating'}
>
  <RefreshCw className={`w-3 h-3 ${variation.status === 'generating' ? 'animate-spin' : ''}`} />
</button>
```

## 状态流转

### 角色/场景生成
```
undefined → generating → completed/failed
```

### 角色变体生成
```
undefined → generating → completed/failed
```

## 优点

1. ✅ **状态持久化**: status字段存储在ProjectState中,会自动保存到IndexedDB
2. ✅ **切换页面不影响**: 即使切换到其他菜单再切换回来,loading状态依然显示
3. ✅ **数据一致性**: 状态与实际生成进度保持同步
4. ✅ **错误处理**: 失败时设置status为'failed',便于用户了解失败状态
5. ✅ **简化代码**: 移除了本地状态管理,代码更简洁
6. ✅ **统一模式**: 与StageDirector的实现保持一致

## 注意事项

1. **兼容性**: status字段为可选(`status?`),因此旧数据不会出现问题
2. **错误恢复**: 如果用户在生成过程中刷新页面,status会保持'generating'状态。未来可以添加检测机制来重置这些"僵尸"状态
3. **并发控制**: 多个角色/场景可以同时处于'generating'状态
4. **数据库存储**: 每次状态更新都会触发IndexedDB保存

## 测试清单

- [x] 生成角色图片时切换菜单,loading状态保持
- [x] 生成场景图片时切换菜单,loading状态保持
- [x] 生成角色变体时切换菜单,loading状态保持
- [x] 生成成功后status正确更新为'completed'
- [x] 生成失败后status正确更新为'failed'
- [x] 按钮在生成过程中正确禁用
- [x] 多个资源同时生成时互不干扰
- [x] 批量生成功能正常工作
- [x] Wardrobe Modal变体生成正常

## 相关文件

- `types.ts` - 添加了Character、Scene、CharacterVariation的status字段
- `components/StageAssets/index.tsx` - 主要修改文件,使用status字段替代generatingIds
- `components/StageAssets/WardrobeModal.tsx` - 移除generatingIds依赖,使用variation.status
- `docs/loading状态持久化修复.md` - StageDirector的相同问题修复文档
- `services/storageService.ts` - 自动持久化ProjectState

## 总结

这个修复与 `StageDirector` 的loading状态持久化修复采用相同的模式,通过将临时UI状态提升到数据模型层面,实现了loading状态的持久化。这样做的好处是:

1. 状态与数据同步,避免不一致
2. 自动持久化到IndexedDB
3. 组件卸载不影响状态
4. 代码更简洁,逻辑更清晰

现在 **StageAssets** 和 **StageDirector** 两个组件的loading状态都能正确持久化,用户在切换菜单时不会丢失生成进度。
