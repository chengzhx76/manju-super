# 素材库透明接入 Spec

## Why

当前项目内的角色、场景、分镜和视频资源仍主要存储在本地数据结构中，生成结果没有自动同步到素材库，导致后续视频链路无法稳定复用素材 ID。需要在不增加用户心智负担的前提下，把素材库 API 融入现有项目与生图流程，同时保证未配置 AK/SK 时仍保持现有本地逻辑不变。

## What Changes

- 新增素材库接入能力，使用全局配置中的 AK/SK 与中转域名访问素材库 API；若未配置则完全回退原有本地逻辑。
- 新增项目级 Asset Group 建档与持久化能力，每个项目仅维护一个素材组，且本地只保存 `GroupId` 关联。
- 约定 Asset Group `Description` 存储季/集映射，单条格式为 `季ID__集ID`，多条记录按换行追加。
- 新增图片/视频资源上传编排，在生成成功后自动调用 `CreateAsset` 上传素材，并只保存本地资源与远端 `AssetId` 的关联。
- 新增异步素材状态轮询机制，使用 `GetAsset` 查询上传后状态，直到 `Active` 或失败。
- 新增远端素材删除能力，对接 `DeleteAsset`。
- 新增项目改名后的素材组名称同步能力，对接 `UpdateAssetGroup`。
- 在项目页面右上角增加“同步素材库”按钮，用于全量上传、合并和检查当前项目所有资源，范围包含角色、场景、分镜、视频和道具。
- 在角色和场景页面 header 增加“同步”按钮，点击后调用 `ListAssets` 做局部合并和检查，并对缺失素材 ID 的资源给出告警。
- 明确一期不接入 `ListAssetGroups`、`GetAssetGroup`；`GetAsset` 虽不直接暴露给用户，但作为异步轮询必需接口纳入实现范围。

## Impact

- Affected specs: 项目生命周期、素材生成流程、全局配置、项目总览页交互、角色页与场景页交互、远端素材同步
- Affected code: `components/ModelConfig/AssetLibrarySettings.tsx`、`services/modelRegistry.ts`、`components/ProjectOverview.tsx`、`contexts/ProjectContext.tsx`、`components/StageAssets/index.tsx`、新增素材库 API 编排服务与最小远端 ID 映射持久化逻辑

## ADDED Requirements

### Requirement: 全局素材库认证配置

系统 SHALL 复用全局配置中的素材库 AK/SK、接入地址与默认配置作为唯一素材库访问凭据，业务页面不得要求用户重复输入素材库认证信息。

#### Scenario: 使用默认素材库配置访问 API

- **WHEN** 用户已在全局配置中保存可用的素材库地址、AK 和 SK
- **THEN** 后续项目创建、素材上传、同步、更新和删除均使用该配置发起请求

#### Scenario: 配置缺失时回退旧逻辑

- **WHEN** 当前没有可用的默认素材库配置
- **THEN** 系统不得发起素材库请求，现有项目创建、生图、删除和页面浏览流程继续按原有本地逻辑执行

### Requirement: 项目级素材组建档

系统 SHALL 在项目首次执行远端同步或首次自动上传前，为该项目创建且仅创建一个远端 Asset Group，并在项目级持久化数据中仅保存远端 `GroupId` 关联。

#### Scenario: 首次远端同步时创建素材组

- **WHEN** 项目尚未绑定远端素材组，且用户触发同步或系统首次自动上传素材
- **THEN** 系统调用 `CreateAssetGroup` 创建 `GroupType=AIGC` 的素材组，并保存返回的 `GroupId`

#### Scenario: 已绑定素材组时避免重复创建

- **WHEN** 项目已存在已保存的远端 `GroupId`
- **THEN** 系统复用该素材组，不得再次调用 `CreateAssetGroup`

### Requirement: 季集描述约定

系统 SHALL 以 `季ID__集ID` 作为 Asset Group `Description` 的标准片段格式，并支持在同一剧本项目素材组中记录多条季/集来源信息；多条记录使用换行分隔。

#### Scenario: 首次写入季集描述

- **WHEN** 某季某集首次产生需要同步的素材
- **THEN** 系统在创建素材组或更新素材组时写入对应格式的描述内容

#### Scenario: 同项目新增其他季或集

- **WHEN** 同一项目下出现新的季或集需要入库
- **THEN** 系统在不破坏既有描述片段的前提下更新 `Description`

### Requirement: 生成结果自动上传素材库

系统 SHALL 在角色、场景、分镜、视频和道具资源生成成功后，根据资源类型和本地资源 ID 自动生成固定命名规则的素材名，并调用 `CreateAsset` 上传远端素材。

#### Scenario: 角色图生成成功后自动上传

- **WHEN** 角色图片生成成功且存在可公网访问的图片地址
- **THEN** 系统以 `role__角色ID` 作为 `Name` 并调用 `CreateAsset`

#### Scenario: 其他资源按类型命名

- **WHEN** 场景、分镜、视频或道具资源生成成功
- **THEN** 系统分别使用 `scene__场景ID`、`shot__分镜ID`、`video__视频ID`、`prop__道具ID` 作为 `Name` 上传

#### Scenario: 缺少上传前置条件时不执行上传

- **WHEN** 缺少 `GroupId`、资源 URL、素材库配置或受支持的资源类型
- **THEN** 系统不得调用 `CreateAsset`，并记录可追溯的错误信息

### Requirement: 异步上传状态轮询

系统 SHALL 将 `CreateAsset` 视为异步过程，并在创建成功返回 `AssetId` 后使用 `GetAsset` 轮询状态，直到素材进入 `Active`、`Failed` 或超时。

#### Scenario: 轮询成功

- **WHEN** `GetAsset` 返回状态为 `Active`
- **THEN** 系统保存远端 `AssetId` 与本地资源的关联，并将该素材视为可用于后续视频链路

#### Scenario: 轮询失败

- **WHEN** `GetAsset` 返回状态为 `Failed` 或轮询超时
- **THEN** 系统记录失败原因并向用户暴露可理解的同步失败状态

### Requirement: 项目名更新

系统 SHALL 在项目名称变更后更新远端素材组名称，但不要求同步更新已上传素材的名称。

#### Scenario: 项目名变更

- **WHEN** 用户修改项目名称且项目已绑定远端素材组
- **THEN** 系统调用 `UpdateAssetGroup` 更新远端素材组名称

### Requirement: 删除与重生成清理远端素材

系统 SHALL 在删除已同步素材，或对已有素材执行重新生图前，先删除旧的远端素材引用，避免保留失效资源。

#### Scenario: 用户删除资源

- **WHEN** 用户删除一个已绑定远端 `AssetId` 的资源
- **THEN** 系统调用 `DeleteAsset` 删除远端素材，并清理本地映射

#### Scenario: 用户重新生图

- **WHEN** 用户对已存在远端素材的资源重新生成图片
- **THEN** 系统先调用 `DeleteAsset` 删除旧素材，再基于新结果重新上传

### Requirement: 项目页全量同步素材库

系统 SHALL 在项目页面右上角提供“同步素材库”按钮，用于对当前项目的角色、场景、分镜、视频和道具执行全量上传、远端合并和缺失检查。

#### Scenario: 已创建项目后首次补同步

- **WHEN** 项目早于素材库配置创建，用户后来补充了 AK/SK 并点击项目页“同步素材库”
- **THEN** 系统为该项目创建或复用唯一素材组，并按命名规则把所有可同步资源上传到素材库

#### Scenario: 重复点击同步素材库

- **WHEN** 用户在项目已有部分或全部资源上传后再次点击“同步素材库”
- **THEN** 系统先拉取远端素材并与本地资源合并，输出未上传资源的检查结果而不是重复创建全部素材

### Requirement: 角色与场景页合并检查

系统 SHALL 在角色和场景页面 header 提供同步按钮，用于按项目素材组拉取远端素材并执行局部合并与检查。

#### Scenario: 用户点击同步按钮

- **WHEN** 用户在角色页或场景页点击同步按钮
- **THEN** 系统调用 `ListAssets` 查询当前项目素材组下的远端素材，并对本地角色或场景执行合并和缺失检查

#### Scenario: 仅同步当前项目相关素材

- **WHEN** 系统执行远端素材同步
- **THEN** 查询条件必须限定当前项目对应的 `GroupId`、`GroupType=AIGC` 和必要状态过滤

#### Scenario: 角色或场景缺失素材 ID

- **WHEN** 角色页或场景页存在本地资源没有关联远端 `AssetId`
- **THEN** 页面需要对这些资源给出明确告警，提示其尚未同步到素材库

## MODIFIED Requirements

### Requirement: 角色与场景生成完成后的处理

系统在资源生成完成后，除更新本地 `referenceImage`、状态和日志外，还 SHALL 在存在素材库配置时触发远端素材同步编排，并仅保存本地资源与远端 `AssetId` 的映射关系；本期默认可直接获得满足 `CreateAsset` 要求的公网 URL。

### Requirement: 项目编辑保存

系统在保存项目名称时，除更新本地项目数据外，还 SHALL 尝试同步远端素材组名称；若远端更新失败，不得回滚本地项目名，但必须记录失败状态并允许后续重试。
