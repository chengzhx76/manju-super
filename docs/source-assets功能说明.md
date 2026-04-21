# Source Assets 功能说明

## 功能概述

Source Assets 功能允许用户一键下载项目中所有生成的源资源文件，包括：

1. **角色参考图** - 所有角色的基础定妆照
2. **角色变体图** - 角色的所有服装/状态变体图
3. **场景参考图** - 所有场景的环境概念图
4. **镜头关键帧** - 每个镜头的起始帧和结束帧图片
5. **视频片段** - 所有生成的视频片段（.mp4 格式）

所有资源会被打包成一个 ZIP 文件，方便后期制作和存档。

## 使用方法

### 1. 进入导出阶段

在主界面点击侧边栏的 **"Phase 04: 成片与导出"** 进入导出阶段。

### 2. 点击 Source Assets 卡片

在页面下方的 "Secondary Options" 区域，点击 **"Source Assets"** 卡片。

### 3. 等待下载完成

系统会：
- 显示下载进度
- 自动收集所有可用资源
- 打包成 ZIP 文件
- 自动触发浏览器下载

### 4. 查看下载的文件

下载的 ZIP 文件命名格式：`{项目名称}_source_assets.zip`

解压后的目录结构：
```
project_source_assets/
├── characters/           # 角色资源
│   ├── 张三_base.jpg           # 基础定妆照
│   ├── 张三_Tactical_Gear.jpg  # 变体图
│   └── 李四_base.jpg
├── scenes/               # 场景资源
│   ├── 办公室.jpg
│   └── 街道.jpg
├── shots/                # 镜头关键帧
│   ├── shot_001_start_frame.jpg
│   ├── shot_001_end_frame.jpg
│   ├── shot_002_start_frame.jpg
│   └── ...
└── videos/               # 视频片段
    ├── shot_001.mp4
    ├── shot_002.mp4
    └── ...
```

## 技术实现

### 使用的库

- **jszip** - 用于在浏览器中创建和压缩 ZIP 文件
- **Fetch API** - 用于下载远程资源

### 核心函数

在 `services/exportService.ts` 中实现了 `downloadSourceAssets()` 函数：

```typescript
export async function downloadSourceAssets(
  project: ProjectState,
  onProgress?: (phase: string, progress: number) => void
): Promise<void>
```

### 进度回调

函数支持进度回调，用于实时更新 UI：
- 0-5%: 加载 ZIP 库
- 5-85%: 下载资源文件
- 85-95%: 生成 ZIP 文件
- 95-100%: 触发下载

## 注意事项

1. **资源可用性** - 如果项目中没有任何生成的资源，会弹出提示信息
2. **文件命名** - 特殊字符会自动替换为下划线，避免文件系统错误
3. **错误处理** - 单个资源下载失败不会中断整个流程，会继续下载其他资源
4. **浏览器兼容性** - 需要现代浏览器支持（Chrome, Firefox, Safari, Edge）

## 后续优化建议

1. 添加资源统计信息显示（如：总大小、文件数量）
2. 支持选择性下载（只下载角色图、只下载视频等）
3. 添加下载历史记录
4. 支持断点续传
5. 支持云端备份
