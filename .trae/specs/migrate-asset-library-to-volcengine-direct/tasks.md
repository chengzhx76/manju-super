# Tasks

- [x] Task 1: 扩展素材库配置以支持 ProjectName
  - [x] SubTask 1.1: 为 `AssetLibraryConfig` 增加 `projectName` 字段，并实现旧配置回退（缺省=default）
  - [x] SubTask 1.2: 更新素材库配置 UI，新增 ProjectName 输入框，并在列表中展示当前配置的 ProjectName
  - [x] SubTask 1.3: 更新“验证”逻辑，使用当前配置的 ProjectName 发起最小验证请求

- [x] Task 2: 实现火山官方 Ark 素材库直连转发层（代签名）
  - [x] SubTask 2.1: 替换现有 relay 转发实现，使其上游请求固定为官方 Ark OpenAPI（支持可选 BaseURL 覆盖）
  - [x] SubTask 2.2: 确保服务端日志与错误返回不包含 AK/SK 明文（必要字段仅脱敏）
  - [x] SubTask 2.3: 保持前端调用接口形态不变或提供兼容层（避免大范围改动业务代码）

- [x] Task 3: 服务层统一携带 ProjectName 并补齐 10 个 API 封装
  - [x] SubTask 3.1: 移除服务层 `ProjectName=default` 硬编码，统一从配置读取并注入请求
  - [x] SubTask 3.2: 补齐 `GetAssetGroup`、`UpdateAsset`、`DeleteAssetGroup` 的封装与调用能力
  - [x] SubTask 3.3: 梳理并更新所有素材库相关调用点，确保不会遗漏 ProjectName

- [x] Task 4: 兼容与迁移策略
  - [x] SubTask 4.1: 针对旧配置 `address`=中转站域名的场景，提供明确的错误提示与迁移指引
  - [x] SubTask 4.2: 明确默认 BaseURL 策略（空/未填=官方），并保证验证与业务流程一致

- [ ] Task 5: 验证与回归
  - [x] SubTask 5.1: 为服务端转发层与关键封装增加单元测试/集成测试（至少覆盖签名、ProjectName 注入、错误透传）
  - [ ] SubTask 5.2: 手动回归：新增/更新素材组、上传素材（轮询到 Active）、列表查询、删除素材、切换 ProjectName 后隔离生效

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1 and Task 2
- Task 5 depends on Task 2 and Task 3
