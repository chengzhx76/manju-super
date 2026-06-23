# 火山引擎素材库直连改造 Spec

## Why
当前素材库请求通过“中转站”域名转发，链路复杂且可控性较弱；同时 `ProjectName` 目前硬编码为 `default`，导致不同用户/不同项目隔离场景下无法稳定访问同一套素材资产。

## What Changes
- 将素材库 API 的上游调用从“中转站地址”改为直连火山引擎官方 Ark 素材库 OpenAPI（服务端代签名转发）。
- 素材库配置中新增并暴露 `ProjectName`，由用户自行配置；所有素材库相关 API 调用统一携带该 `ProjectName`。
- 补齐并统一封装 10 个素材库 API：CreateAssetGroup、CreateAsset、ListAssetGroups、ListAssets、GetAsset、GetAssetGroup、UpdateAssetGroup、UpdateAsset、DeleteAsset、DeleteAssetGroup。
- **BREAKING**：素材库配置中的 `address` 字段不再表示“中转站地址”，调整为“可选的 Ark OpenAPI BaseURL 覆盖项”（默认使用官方域名）。若用户仍保留旧中转站地址，将导致请求失败，需要迁移配置。
- 安全与可观测性：服务端转发与日志不得输出 AK/SK 明文；前端仅展示脱敏后的 Key 信息。

## Impact
- Affected specs: 素材库配置、素材同步（上传/轮询/对账/删除）、项目级素材组生命周期、素材库验证能力
- Affected code:
  - 前端配置：`components/ModelConfig/AssetLibrarySettings.tsx`
  - 配置存储：`services/modelRegistry.ts`、`types/model.ts`
  - 素材库服务层：`services/assetRelayService.ts`
  - 服务端转发：`server/relayProxyCore.mjs`（替换/重命名为官方 Ark 素材库转发实现）及其挂载处

## ADDED Requirements

### Requirement: 用户可配置 ProjectName
系统 SHALL 在素材库配置中新增 `ProjectName` 字段，并在 UI 中允许用户编辑与切换默认配置。

#### Scenario: 用户配置 ProjectName 后生效
- **WHEN** 用户在素材库配置中填写 `ProjectName` 并保存为当前使用配置
- **THEN** 后续 `CreateAssetGroup/CreateAsset/List*/Get*/Update*/Delete*` 请求均携带该 `ProjectName`

#### Scenario: 兼容旧配置
- **WHEN** 用户配置中缺少 `ProjectName`
- **THEN** 系统使用 `default` 作为回退值，并提示用户该值可配置以支持项目隔离

### Requirement: 直连火山官方 Ark 素材库 OpenAPI
系统 SHALL 使用本项目自带服务端接口代签名并转发请求到火山引擎官方 Ark OpenAPI（而非第三方中转站）。

#### Scenario: 上游请求域名固定为官方
- **WHEN** 用户未配置自定义 BaseURL 覆盖项
- **THEN** 服务端上游请求目标为官方 Ark 域名（如 `https://ark.cn-beijing.volces.com`）

#### Scenario: BaseURL 覆盖（可选）
- **WHEN** 用户配置了自定义 BaseURL
- **THEN** 系统仅将其作为官方 Ark OpenAPI 的 BaseURL 覆盖项使用（用于联调/私有域名），不得再承诺兼容旧“中转站协议”

### Requirement: 覆盖 10 个素材库 API
系统 SHALL 在服务层提供 10 个 API 的统一封装，并在业务流程中复用同一封装层。

#### Scenario: 统一封装与错误透传
- **WHEN** 任一素材库 API 请求失败
- **THEN** 系统向上抛出可读错误信息，并保留 requestId/traceId（如有）用于排查，但不得包含 AK/SK 明文

## MODIFIED Requirements

### Requirement: 素材库配置字段语义调整（**BREAKING**）
系统 SHALL 将素材库配置中的 `address` 语义从“中转站地址”调整为“Ark OpenAPI BaseURL（可选覆盖项）”，默认值使用官方 Ark 域名。

## REMOVED Requirements

### Requirement: 依赖第三方中转站域名访问素材库
**Reason**: 降低外部依赖与链路复杂度，避免中转层变更导致不可控失败。
**Migration**: 用户需将素材库配置中的地址更新为官方 Ark 域名（或留空使用默认），并补充配置 `ProjectName`。
