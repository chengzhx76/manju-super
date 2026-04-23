# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

BigBanana AI Director（AI 漫剧工场）是一个 AI 驱动的视频/动态漫画制作工作台。采用 "Script-to-Asset-to-Keyframe" 流水线，从文本输入生成完整短剧，可精准控制角色一致性、场景连续性和镜头运动。

## 常用命令

```bash
pnpm dev              # 启动开发服务器 (http://localhost:3000)
pnpm run build        # 生产构建（先执行 check:utf8 UTF-8 检查）
pnpm run preview      # 预览生产构建
pnpm lint             # 运行 ESLint 并自动修复
pnpm run format       # 使用 Prettier 格式化所有文件
pnpm run check:format # 检查格式（不修改）
pnpm run check:utf8   # 验证 UTF-8 编码（构建前必须通过）
pnpm run media-proxy  # 启动本地媒体代理服务器
```

## 架构设计

### 关键帧驱动的视频生成

工作流围绕 **关键帧** 概念设计：

1. 生成精准的 **Start Frame**（强一致性的关键帧）
2. 可选定义 **End Frame**（镜头结束状态）
3. 使用视频模型（Veo、Sora）在帧间插值生成

### 状态机（EpisodeStage）

每集按 `types.ts` 中定义的阶段推进：

- `script` → `assets` → `shot` → `video` → `export` → `prompts`

### 核心数据模型

主要类型定义在 `types.ts`：

- **`SeriesProject`**：顶层容器（剧集），包含 `characterLibrary`、`sceneLibrary`、`propLibrary`
- **`Episode`**（即 `ProjectState`）：单集，包含 `scriptData` 和 `shots`
- **`ScriptData`**：从剧本解析出的角色、场景、道具
- **`Shot`**：单个镜头，包含 `keyframes[]` 和 `interval`（视频结果）

### 存储

通过 `services/storageService.ts` 使用 **IndexedDB**。数据结构：

- `seriesProjects` → 包含项目级资产
- `series` → 季/篇章分组
- `episodes` → 单集，含 `scriptData` 和 `shots`

## 核心服务

| 服务                            | 用途                                     |
| ------------------------------- | ---------------------------------------- |
| `services/storageService.ts`    | IndexedDB 增删改查（剧集、项目、资产库） |
| `services/ai/apiCore.ts`        | API 调用、重试逻辑、JSON 解析、密钥管理  |
| `services/ai/scriptService.ts`  | 剧本解析、分镜生成                       |
| `services/ai/visualService.ts`  | 图像生成、角色/场景视觉                  |
| `services/ai/videoService.ts`   | 视频生成（Veo、Sora）                    |
| `services/ai/shotService.ts`    | 关键帧优化、九宫格、镜头拆分             |
| `services/modelRegistry.ts`     | 模型注册表和 API 密钥管理                |
| `services/assetRelayService.ts` | 资产生成编排，支持增量重跑               |

## Context 层级

`ProjectContext.tsx`（`useProjectContext`）提供：

- 项目/单集数据和增删改查操作
- 库管理（角色、场景、道具）
- 同步工具函数（`syncCharacterToEpisode`、`syncAllCharactersToEpisode`）
- 资产版本控制（已同步资产的 libraryVersion）

## 增量生成（assetRelayService）

生成流水线通过 `scriptData` 中的 `generationMeta` 支持增量重跑：

- 通过 `structureKey/visualsKey/shotsKey` 分析阶段状态
- 仅重跑过时阶段，保留兼容的先前结果
- 必要时将旧资产 ID 映射到新 ID

## 添加新功能

**新阶段（Stage）：**

1. 在 `components/StageNew/` 下创建组件
2. 在 `App.tsx` 的 `EpisodeWorkspace` switch 中添加路由
3. 在 `components/Sidebar.tsx` 中添加导航项

**新 AI 模型：**

1. 在 `services/modelRegistry.ts` 注册模型
2. 若 API 格式特殊，在 `services/adapters/` 实现适配器
3. 在 `imageAdapter.ts` 或 `videoAdapter.ts` 中添加模型特定处理

**新资产类型：**

1. 在 `types.ts` 定义接口
2. 在 `SeriesProject` 类型中添加库数组
3. 在 `services/characterSyncService.ts` 添加同步逻辑
4. 在 `ProjectContext` 中添加工厂管理函数

## 代码模式

- 阶段组件使用懒加载（减少初始包体积）
- `EpisodeWorkspace` 中自动保存，1 秒防抖
- 组件卸载/中断时通过 `clearInFlightGenerationStates` 清理生成状态
- 单集资产引用跟踪同步状态（`synced`、`local-only`）

## 注意事项

- 所有 API 密钥通过 `services/modelRegistry.ts` 管理，不硬编码
- JSON 解析使用多候选恢复机制（`apiCore.ts`），剥离 think 标签、代码块、修复常见问题
- 构建前必须通过 UTF-8 验证，防止乱码
- 移动端（< 1024px）显示警告页面，应用仅支持桌面端
