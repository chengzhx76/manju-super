# UMF-Manju 项目全局开发索引 (Project Development Index)

这份全局索引文件旨在帮助开发者快速了解本项目的架构、核心模块、数据流以及主要服务的职责，以便于后续开发和维护。

## 1. 核心技术栈
- **前端框架**: React 19 + Vite + TypeScript
- **路由**: React Router v7 (`react-router-dom`)
- **样式**: Tailwind CSS + 自定义 CSS Variables (`public/styles/base.css`)
- **图标**: Lucide React
- **数据存储**: IndexedDB (通过 `services/storageService.ts` 封装)
- **AI 代理服务**: 本地 Node.js 代理 (`server/mediaProxyServer.mjs`, `server/newApiProxyServer.mjs`)

---

## 2. 目录结构概览

```text
.
├── components/          # React 核心组件 (按功能模块划分)
├── services/            # 业务逻辑与 API 服务层
├── hooks/               # 自定义 React Hooks
├── contexts/            # 全局 React Context (Project, Theme 等)
├── constants/           # 静态常量定义
├── types/               # TypeScript 类型定义文件
├── server/              # 本地代理服务器 (规避跨域或处理媒体转发)
├── scripts/             # 构建与校验脚本 (如 check-utf8.mjs)
└── public/              # 静态资源与全局样式
```

---

## 3. 核心功能模块 (Components)

本项目是一个功能完整的 AI 视频生成工作台，按制作管线分为多个 `Stage`：

| 模块目录 | 核心职责 | 关键组件/文件 |
| :--- | :--- | :--- |
| **`StageScript/`** | **剧本与拆解**：输入文本剧本，AI自动拆解为场景、角色、道具及分镜。 | `ScriptEditor`, `SceneBreakdown`, `AssetMatchDialog` |
| **`StageAssets/`** | **资产管理**：生成和管理本剧的视觉资产（角色形象、场景设计、道具）。 | `CharacterCard`, `SceneCard`, `WardrobeModal` |
| **`StageDirector/`** | **导演工作台**：管理分镜 (Shots)、提示词、关键帧、配音及视频生成。 | `ShotWorkbench`, `VideoGenerator`, `DubbingPanel` |
| **`StagePrompts/`** | **提示词工程**：统一管理与验证各种 AI 模型的 Prompt 模板。 | `PromptEditor`, `TemplateSection`, `StatusBadge` |
| **`StageExport/`** | **合成与导出**：可视化时间线，渲染日志查看，并导出最终视频。 | `TimelineVisualizer`, `VideoPlayerModal` |
| **`CharacterLibrary/`**| **全局资产库**：管理跨剧集/跨项目复用的角色、场景和道具库。 | `AssetLibraryEditorCard`, `CharacterSyncBanner` |
| **`ModelConfig/`** | **AI模型配置**：配置 LLM、生图、生视频等各种 AI 模型的密钥和参数。 | `GlobalSettings`, `ModelList` |
| **`account-center/`** | **账户与计费**：处理用户登录、额度消耗与充值统计。 | `AuthView`, `BillingPanel`, `TokensPanel` |

---

## 4. 核心服务层 (Services)

所有与数据处理、存储、AI 对接相关的逻辑都封装在 `services/` 目录下：

### 4.1 AI 通信与适配 (`services/ai/` & `services/adapters/`)
- **`apiCore.ts`**: AI API 请求的核心封装，处理重试、超时等逻辑。
- **`adapters/*`**: 抹平不同 AI 服务商（OpenAI, Anthropic, Midjourney, 各种 Video 模型）API 的差异，提供统一接口。
- **`scriptService.ts` / `visualService.ts` / `shotService.ts`**: 分别对应剧本拆解、生图、生视频的具体业务逻辑封装。

### 4.2 数据流与持久化 (`services/`)
- **`storageService.ts`**: 封装 IndexedDB 的 CRUD 操作，用于保存 `SeriesProject` (剧集)、`ProjectState` (单集状态) 以及全局库 `AssetLibraryItem`。
- **`assetMatchService.ts` & `assetLibraryService.ts`**: 跨项目复用逻辑，匹配剧本中的角色与全局资产库中的现有角色。
- **`characterSyncService.ts`**: 保证剧集内的资产与全局资产库的数据同步。

### 4.3 质量与校验 (`services/`)
- **`qualityAssessmentService.ts` / `qualityAssessmentV2Service.ts`**: 生成分镜或图像后的质量校验（一致性检查、修复建议）。
- **`promptLintService.ts`**: 检查 Prompt 格式是否符合目标模型要求。

---

## 5. 核心状态与数据模型 (Types)

所有关键类型定义在根目录的 `types.ts` 和 `types/model.ts` 中。

- **`SeriesProject`**: 剧集项目对象（包含全局资产引用和包含的集数）。
- **`ProjectState`**: 核心对象，代表**单集**的所有状态数据。包含：
  - `scriptData`: 剧本拆解后的数据结构（角色、场景、道具、分镜）。
  - `shots`: 经过修改和生成后的最终分镜列表（含视频 URL、关键帧等）。
- **`Character` / `Scene` / `Prop`**: 资产对象模型。
- **`AssetLibraryItem`**: 跨项目存储在全局库中的序列化资产。

---

## 6. 后续开发指南

### 状态共享策略
- 跨页面级的单集数据通过 `contexts/ProjectContext.tsx` (`useProjectContext`) 进行下发。
- 需要持久化时，调用 `updateProject`，Context 内部会自动将变更写入到 IndexedDB 中。

### 新增页面或阶段 (Stage)
1. 在 `components/` 下建立新的模块目录（如 `StagePostProduction/`）。
2. 在模块内创建 `index.tsx` 暴露主要视图。
3. 在 `App.tsx` 中注册路由。
4. 在 `components/Sidebar.tsx` 中添加导航项。

### 新增 AI 模型支持
1. 在 `services/modelRegistry.ts` 中注册模型的基础信息。
2. 在 `services/adapters/` 中实现该模型的转换适配器（如果其 API 格式特殊）。
3. 如果是特定类型的模型（生图/生视频），更新对应的 `imageAdapter.ts` 或 `videoAdapter.ts`。