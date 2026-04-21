# Tasks

* [x] Task 1: 梳理对象存储接入边界与配置入口

  * [x] SubTask 1.1: 盘点现有资源库配置、上传链路、生成图链路和历史资源访问链路

  * [x] SubTask 1.2: 明确火山引擎对象存储配置项字段定义，至少覆盖 `region`、`bucketName`、`host`、`accessKeyId`、`secretAccessKey`

  * [x] SubTask 1.3: 明确对象存储配置作为独立配置项（与素材库配置并列）、本地浏览器读取方式，以及上传时向后端传递 `AK/SK` 的边界

  * [x] SubTask 1.4: 明确未配置对象存储 `AK/SK` 时的回退逻辑，继续沿用原有生成资源链接

* [x] Task 2: 设计统一资源上传与访问方案

  * [x] SubTask 2.1: 定义资源写入对象存储后的统一返回结构与元数据字段

  * [x] SubTask 2.2: 设计资源对象命名规则，采用 `manju/漫剧项目ID/季ID/类型英文/资源` 固定路径前缀，类型覆盖 `role`、`scene`、`prop`、`audio`、`video`、`shot`，文件名采用 `资源ID + 时间戳 + 扩展名`

  * [x] SubTask 2.3: 明确资源访问地址生成方式，采用公网读与固定 `host` 拼接访问地址，并支持基于元数据重新生成地址

  * [x] SubTask 2.4: 设计删除资源和重新生图时“先删业务引用、后异步删桶内旧对象”的清理策略、元数据切换顺序与失败记录逻辑，删除失败仅记日志且不进入重试队列

* [x] Task 3: 设计 base64 治理与兼容方案

  * [x] SubTask 3.1: 识别当前仍依赖 `base64` 的接口与调用方

  * [x] SubTask 3.2: 设计文件流、对象存储 URL 或远端地址替代 `base64` 的主链路方案

  * [x] SubTask 3.3: 设计旧链路兼容转换策略，明确首期只覆盖“资源库上传 + 重新生图 + 删除”，不处理历史数据迁移

* [x] Task 4: 设计资源类型接入范围与迁移策略

  * [x] SubTask 4.1: 明确资源库上传文件、重新生图和删除资源的首期接入范围

  * [x] SubTask 4.2: 明确历史数据本期不处理，避免引入补传和批量迁移范围

  * [x] SubTask 4.3: 明确切换顺序、灰度策略和回滚条件，保证对象存储配置缺失时可回退原逻辑

* [x] Task 5: 定义安全、日志与验收标准

  * [x] SubTask 5.1: 明确浏览器持有长期 `AK/SK`、上传时传后端、公网读固定 `host`、错误反馈和审计日志的要求

  * [x] SubTask 5.2: 定义关键验收场景，包括配置校验、上传成功、访问稳定、删除与重生图清理生效、旧资源兼容和失败可追溯

  * [x] SubTask 5.3: 明确上线前需要完成的联调、回归与发布检查项

# Task Dependencies

* Task 2 depends on Task 1

* Task 3 depends on Task 1 and Task 2

* Task 4 depends on Task 1 and Task 2

* Task 5 depends on Task 2, Task 3 and Task 4
