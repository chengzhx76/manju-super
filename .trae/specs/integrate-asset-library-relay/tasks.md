# Tasks

- [x] Task 1: 建立素材库远端接入基础能力
  - [x] SubTask 1.1: 设计并补充项目与资源所需的最小远端映射字段，本地仅持久化 `GroupId` 和 `AssetId` 关联
  - [x] SubTask 1.2: 新增素材库 API 服务层，统一封装 `CreateAssetGroup`、`CreateAsset`、`ListAssets`、`GetAsset`、`UpdateAssetGroup`、`DeleteAsset`
  - [x] SubTask 1.3: 复用全局素材库默认配置作为 API 认证来源，并在缺失 AK/SK 时完整回退原有本地逻辑

- [x] Task 2: 接入项目级 Asset Group 生命周期
  - [x] SubTask 2.1: 在项目首次远端同步或首次自动上传时创建唯一 Asset Group，并保存远端 `GroupId`
  - [x] SubTask 2.2: 按 `季ID__集ID` 规则生成和更新 `Description` 内容
  - [x] SubTask 2.3: 在项目改名后调用 `UpdateAssetGroup` 同步远端名称，保留失败重试信息

- [x] Task 3: 接入生成成功后的自动上传与异步轮询
  - [x] SubTask 3.1: 将角色、场景、分镜、视频生成成功事件接入统一上传编排
  - [x] SubTask 3.2: 按资源类型生成 `role__资源ID`、`scene__资源ID`、`shot__资源ID`、`video__资源ID` 命名并调用 `CreateAsset`
  - [x] SubTask 3.3: 在 `CreateAsset` 后轮询 `GetAsset`，写回 `AssetId` 关联并记录失败原因
  - [x] SubTask 3.4: 确保重复触发上传时避免并发冲突、重复建档和脏状态覆盖

- [x] Task 4: 接入删除、重生成与远端对账
  - [x] SubTask 4.1: 在删除资源时调用 `DeleteAsset` 并清理本地远端映射
  - [x] SubTask 4.2: 在重新生图前先删除旧远端素材，再上传新的生成结果
  - [x] SubTask 4.3: 将远端素材名与本地资源 ID 的映射规则用于去重、合并和缺失检查

- [x] Task 5: 增加项目页全量同步能力
  - [x] SubTask 5.1: 在项目页面右上角增加“同步素材库”按钮与加载/结果反馈
  - [x] SubTask 5.2: 点击后调用 `ListAssets` 做远端合并与缺失检查，并把当前项目所有可同步资源补传到素材库
  - [x] SubTask 5.3: 支持重复点击时输出“未上传资源数量”之类的检查结果，而不是重复上传全部资源

- [x] Task 6: 增加角色页和场景页局部合并检查能力
  - [x] SubTask 6.1: 在角色和场景页面 header 增加同步按钮与加载/失败反馈
  - [x] SubTask 6.2: 点击后调用 `ListAssets`，按当前项目 `GroupId`、资源类型和命名规则过滤远端素材
  - [x] SubTask 6.3: 对没有 `AssetId` 的本地角色或场景给出明确告警，并避免覆盖用户未保存的本地编辑

- [ ] Task 7: 完成验证与回归检查
  - [ ] SubTask 7.1: 为服务层和关键编排补充针对性的单元测试或集成测试
  - [ ] SubTask 7.2: 手动验证无 AK/SK 回退、项目页全量同步、角色/场景页检查、项目改名、删除、重生成等主流程
  - [ ] SubTask 7.3: 明确一期暂不接入 `ListAssetGroups`、`GetAssetGroup`，确认 `GetAsset` 仅作为内部轮询使用

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1 and Task 3
- Task 5 depends on Task 1, Task 2 and Task 3
- Task 6 depends on Task 1, Task 2 and Task 5
- Task 7 depends on Task 2, Task 3, Task 4, Task 5 and Task 6
