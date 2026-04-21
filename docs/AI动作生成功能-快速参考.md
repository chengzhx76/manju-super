# AI动作生成功能 - 快速参考

## 一句话说明
在叙事动作编辑弹框中，点击"AI生成动作建议"按钮，AI会根据首尾帧自动生成符合场景的动作描述。

## 快速使用

```
1. 选择镜头 → 2. 点击"编辑叙事动作" → 3. 点击"AI生成动作建议" → 4. 等待生成 → 5. 保存
```

## 核心代码

### 服务层函数
```typescript
// services/geminiService.ts
export const generateActionSuggestion = async (
  startFramePrompt: string,  // 首帧提示词
  endFramePrompt: string,    // 尾帧提示词
  cameraMovement: string,    // 镜头运动
  model: string = 'gpt-5.1'
): Promise<string>
```

### 组件增强
```typescript
// EditModal.tsx - 新增props
showAIGenerate?: boolean;      // 是否显示AI生成按钮
onAIGenerate?: () => Promise<void>;  // AI生成回调
isAIGenerating?: boolean;      // 是否正在生成
```

### 主控制逻辑
```typescript
// index.tsx
const handleGenerateAIAction = async () => {
  // 1. 获取首尾帧信息
  // 2. 调用AI服务
  // 3. 更新编辑框内容
}
```

## 参考案例类型

| 类型 | 特点 | 适用场景 |
|------|------|----------|
| 特效魔法戏 | 视觉冲击、能量表现 | 魔法施放、能量爆发 |
| 打斗戏 | 李小龙级别动作设计 | 肉搏战、武打场面 |
| 蓄力攻击 | 震撼感、压迫感 | 大招释放、威力展示 |
| 魔法展开 | 多镜头切换、特写结合 | 领域展开、大范围魔法 |
| 快速移动 | 模糊拖影、速度感 | 瞬移、疾跑、追逐 |
| 能量爆发 | 雷暴光芒、威严姿态 | 变身、觉醒、力量展示 |

## 技术细节

### 提示词工程
- **温度参数**: 0.8（平衡创意和一致性）
- **最大Token**: 4096
- **参考示例**: 6种高质量案例
- **输出格式**: 直接文本，无JSON标记

### UI交互
- **按钮样式**: 渐变色（indigo到purple）
- **加载反馈**: 旋转图标+状态文字
- **禁用逻辑**: 生成时禁用编辑和保存
- **错误处理**: Alert提示+API Key错误特殊处理

## 常见问题

**Q: 为什么按钮是灰色的？**  
A: 需要先生成或编辑首帧和尾帧的提示词。

**Q: 生成需要多久？**  
A: 通常5-15秒，取决于网络和模型响应速度。

**Q: 可以生成多个方案吗？**  
A: 当前版本生成单个方案，可多次点击获取不同建议。

**Q: 生成的内容可以修改吗？**  
A: 可以，生成后可以直接在文本框中编辑。

## 更新内容

### 新增文件
- `docs/AI动作生成功能说明.md` - 详细文档
- `docs/AI动作生成功能-快速参考.md` - 本文档

### 修改文件
- `services/geminiService.ts` - 添加generateActionSuggestion函数
- `components/StageDirector/EditModal.tsx` - 增强支持AI生成
- `components/StageDirector/index.tsx` - 集成AI生成逻辑

## 相关链接

- [完整功能说明](./AI动作生成功能说明.md)
- [动作提示词参考](./动作提示词参考.md)
- [编辑功能快速参考](./编辑功能-快速参考.md)
