<span id="#.5Yqf6IO95o-P6L-w"></span>
## **功能描述**
此接口用于从桶中下载指定对象。桶的拥有者或者被授权的用户才具有调用此接口下载对象的权限。多版本状态下，如果未指定版本号，下载当前版本的对象，如果指定`versionId`，则返回指定版本的对象。
<span id="#.5pyN5Yqh56uv5Yqg5a-G"></span>
## 服务端加密
如果要下载的对象使用 TOS 托管加密密钥的服务端加密（SSE\-TOS）或使用 KMS 托管加密密钥的服务端加密（SSE\-KMS），则不应在 GET 请求中携带加密请求头域，如：`x-tos-server-side-encryption`，如果携带了该加密头域，会收到 HTTP 400 BadRequest 错误。
如果客户端在对象上传时，使用客户提供的加密密钥（SSE\-C）进行服务端加密，当下载对象时，你必须携带以下头域：

* x\-tos\-server\-side\-encryption\-customer\-algorithm
* x\-tos\-server\-side\-encryption\-customer\-key
* x\-tos\-server\-side\-encryption\-customer\-key\-MD5

关于服务端加密的更多详细信息，请参见[服务端加密概述](/docs/6349/105525)。
<span id="#319fccd0"></span>
## 注意事项
使用 GetObject 接口下载归档存储、冷归档存储和深度冷归档存储对象前，需要先恢复对象。
<span id="#1e8f4b5f"></span>
## 匿名请求说明
TOS 不允许在匿名访问的 Get 请求中自定义响应头域。详情请参见[对象存储匿名请求限制说明](/docs/6349/1451316)。
<span id="#.6K-35rGC5raI5oGv5qC35byP"></span>
## **请求消息样式**
```JSON
GET /objectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: GMT Date
Authorization: authorization string
```

<span id="#.6K-35rGC5Y-C5pWw5ZKM5raI5oGv5aS0"></span>
## **请求参数和消息头**
该请求的公共请求消息头，请参见[公共参数](/docs/6349/75044)。

|**名称** |**位置** |**参数类型** |**是否必选** |**示例值** |**说明** |
|---|---|---|---|---|---|
|Range |Header |String |否 |bytes=0\-4 |指定对象的获取范围。如未指定，则获取整个对象。Range 是一个范围，它的起始值最小为 0，最大为对象长度减 1。Range 范围的起始值为必填项，如果 Range 只包含起始值，表示获取起始值到对象长度减 1 这个区间的对象内容。格式为：bytes=start\-end。|\
| | | | | |:::tip|\
| | | | | |携带 Range 头域后，响应消息的 ETag 仍是对象的 ETag，而不是 Range 范围内对象的 ETag。|\
| | | | | ||\
| | | | | |:::|
|If\-Match |Header |String |否 |8a36be0d764367db4eea2deb16b71543 |只有当传入的 ETag 与对象的 ETag 相等才返回对象，否则返回 412 Precondition Failed。 |
|If\-Modified\-Since |Header |String |否 |Mon, 04 Jul 2022 02:57:31 GMT |只有在对象自指定时间以来被修改过时才返回该对象，否则返回 304 Not Modified。时间格式为 RFC1123 GMT。 |
|If\-None\-Match |Header |String |否 |8a36be0d764367db4eea2deb16b71543 |只有当传入的 ETag 与对象的 ETag 不相等才返回对象，否则返回 304 Not Modified。 |
|If\-Unmodified\-Since |Header |String |否 |Mon, 04 Jul 2022 02:57:31 GMT |只有在对象自指定时间以来未被修改过时才返回该对象，否则返回412 Precondition Failed。时间格式为 RFC1123 GMT。 |
|x\-tos\-server\-side\-encryption\-customer\-algorithm |Header |String |否，使用 SSE\-C 加密时，必选。 |AES256 |对象是 SSE\-C 加密时使用该头域，该头域表示解密对象使用的算法，取值说明如下：|\
| | | | | ||\
| | | | | |* AES256：使用 AES256 算法加密对象。 |
|x\-tos\-server\-side\-encryption\-customer\-key |Header |String |否，使用 SSE\-C 加密时，必选。 |YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE= |与 `x-tos-server-side-encryption-customer-algorithm` 配套使用，指定 SSE\-C 加密目标对象的密钥，格式为 base64 编码的 256 bit 的加密密钥。 |
|x\-tos\-server\-side\-encryption\-customer\-key\-md5 |Header |String |否，使用 SSE\-C 加密时，必选。 |0gYVWExOAz67jX5A6qY4+A== |对象是 SSE\-C 加密时使用该头域，与 x\-tos\-server\-side\-encryption\-customer\-key 配套使用，该头域表示解密对象使用的密钥的 MD5 值。该头域由密钥的 128\-bit MD5 值经过 base64\-encoded 得到，该值用于消息完整性检查，确认加密密钥在传输过程中没有出错。 |
|x\-tos\-traffic\-limit |Header |String |否 |819200 |TOS 提供单链接限速功能，在上传、下载文件等操作中进行流控控制，以保证其他应用的网络带宽。取值说明如下：|\
| | | | | ||\
| | | | | |* 取值范围：245760\-838860800，单位为bit/s|\
| | | | | |* Header和Query中不能同时存在此参数 |
|x\-tos\-traffic\-limit |Query |String |否 |819200 |TOS 提供单链接限速功能，在上传、下载文件等操作中进行流控控制，以保证其他应用的网络带宽。取值说明如下：|\
| | | | | ||\
| | | | | |* 取值范围：245760\-838860800，单位为bit/s|\
| | | | | |* Header和Query中不能同时存在此参数 |
|response\-content\-disposition |Query |String |否 |attachment; filename=123.txt |指定服务端返回的 Content\-Disposition 响应头。 |
|response\-content\-encoding |Query |String |否 |gzip |指定服务端返回的 Content\-Encoding 响应头。 |
|response\-content\-language |Query |String |否 |en\-US |指定服务端返回的 Content\-Language 响应头。 |
|response\-content\-type |Query |String |否 |text/plain |指定服务端返回的 Content\-Type 响应头。 |
|response\-expires |Query |String |否 |Mon, 04 Jul 2022 02:57:31 GMT |指定服务端返回的 Expires 响应头。 |
|versionId |Query |String |否 |123 |获取指定版本号的对象。 |

<span id="#.6K-35rGC5YWD57Sg"></span>
## **请求元素**
该请求消息中无请求元素。
<span id="#.5ZON5bqU5raI5oGv5aS0"></span>
## **响应消息头**
该请求返回公共响应消息头，请参见[公共参数](/docs/6349/75044)。
:::tip
使用 GetObject 接口下载对象时，如果对象类型是软链接对象，则不同的响应头返回的内容不同，说明如下：

* `Content-Length`、`ETag` 、`x-tos-storage-class` 和 `x-tos-hash-crc64ecma`：返回软链接对象指向的目标对象的信息。
* `Last-Modified`：返回软链接对象和目标对象两者之间更新较晚的日期。
* 其他响应头：返回软链接对象信息。


:::
|**名称** |**参数类型** |**示例值** |**说明** |
|---|---|---|---|
|Content\-Range |String |bytes 0\-4/300 |返回的对象数据范围。 |
|Last\-Modified |String |Mon, 02 Jul 2021 10:29:28 GMT |对象最后更新日期。 |
|x\-tos\-delete\-marker |Bool |true |对象是否标记删除。如果不是，不会返回此消息头。 |
|x\-tos\-server\-side\-encryption |String |kms |对象是 SSE\-TOS 加密或 SSE\-KMS 时返回该头域，表示对象的服务端加密方式，取值如下：|\
| | | ||\
| | | |* `AES256`：使用 SSE\-TOS 加密方式，并采用 AES256 加密算法。|\
| | | |* `SM4`：使用 SSE\-TOS 加密方式，并采用 SM4 加密算法。|\
| | | |* `kms`: 使用 SSE\-KMS 加密方式。|\
| | | ||\
| | | |关于 SSE\-TOS、 SSE\-KMS 加密方式详细说明，请参见[服务端加密概述](/docs/6349/74856)。 |
|x\-tos\-server\-side\-encryption\-kms\-key\-id |String |trn:kms:cn\-beijing:20000111:keyrings/ring\-test/keys/key\-test |对象采用 SSE\-KMS 加密方式时返回该头域，该头域表示 SSE\-KMS 加密使用的 KMS 主密钥 ID。 |
|x\-tos\-server\-side\-encryption\-customer\-algorithm |String |AES256 |对象是 SSE\-C 加密时返回此头域，该头域表示解密使用的算法。 |
|x\-tos\-server\-side\-encryption\-customer\-key\-MD5 |String |0gYVWExOAz67jX5A6qY4+A== |对象是 SSE\-C 加密时返回此头域，该头域表示解密使用的密钥的 MD5 值。 |
|x\-tos\-version\-id |String |57AF1A32CECB56721267 |对象的版本号。如果不存在版本号，则该消息头不会出现在响应消息中。 |
|x\-tos\-website\-redirect\-location |String |/abc |当桶设置了 Website 配置，可以将获取这个对象的请求重定向到桶内另一个对象或一个外部的 URL，TOS 将这个值从头域中取出，保存在对象的元数据中。 |
|x\-tos\-object\-type |String |Symlink |对象为非 Normal 对象时，会返回此响应头，取值说明如下：|\
| | | ||\
| | | |* `Appendable`：该对象为追加写接口上传的对象。|\
| | | |* `Symlink`：该对象为软链接对象。 |
|x\-tos\-storage\-class |String |STANDARD |对象的存储类型，取值说明如下：|\
| | | ||\
| | | |* `STANDARD`：标准存储。|\
| | | |* `IA`：低频访问存储。|\
| | | |* `INTELLIGENT_TIERING`：智能分层存储。|\
| | | |* `ARCHIVE_FR`：归档闪回存储。|\
| | | |* `ARCHIVE`：归档存储。|\
| | | |* `COLD_ARCHIVE`：冷归档存储。|\
| | | |* `DEEP_COLD_ARCHIVE`：深度冷归档存储。 |
|x\-tos\-storage\-tier |String |INFREQUENT |智能分层对象所属的访问层级，取值说明如下：|\
| | | ||\
| | | |* FREQUENT：智能分层高频访问层。|\
| | | |* INFREQUENT：智能分层低频访问层。|\
| | | |* ARCHIVEFR：智能分层归档闪回访问层。|\
| | | ||\
| | | |:::tip|\
| | | |仅智能分层对象会返回 `x-tos-storage-tier` 参数。|\
| | | ||\
| | | |:::|
|x\-tos\-hash\-crc64ecma |Integer |6186290338114851376 |表示该对象的 64 位 CRC 值。该 64 位 CRC 根据 ECMA\-182 标准计算得出。|\
| | | |:::tip|\
| | | |对 TOS 服务端支持 64 位 CRC 校验前创建的对象，则该消息头不会出现在响应消息中。|\
| | | ||\
| | | |:::|
|x‑tos‑tagging‑count |String |3 |对象的标签个数。仅当拥有对象标签读取权限时返回。 |
|X\-Tos\-Expiration |String |expiry\-date="Sun, 25 Dec 2022 00:00:00 GMT" |对象的过期日期，存在以下两种情况：|\
| | | ||\
| | | |* 如果该对象匹配生命周期的删除规则，则返回以下参数：|\
| | | |   * `expiry-date`：对象的过期日期。|\
| | | |   * `rule-id`：生命周期规则 ID。|\
| | | |* 如果该对象设置了过期时间，则会返回 `expiry-date` 参数，表示对象的过期日期，`rule-id` 参数则为空。 |
|x\-tos\-replication\-status |String |COMPLETE |对象的跨区域或同区域复制状态，存在以下两种情况：|\
| | | ||\
| | | |* 如果是源存储桶的对象，该参数取值如下：|\
| | | |   * `COMPLETE`：该对象已成功复制到目标桶。|\
| | | |   * `PENDING`：该对象正在复制中。|\
| | | |   * `FAILED`：该对象复制失败。|\
| | | |* 如果是目标存储桶的对象，该参数只有一个取值，即 `REPLICA`，表示该对象是通过跨区域复制或同区域复制功能同步过来的。|\
| | | ||\
| | | |:::warning|\
| | | ||\
| | | |* 查询对象跨区域复制或同区域复制状态功能（即 x\-tos\-replication\-status 参数）目前处于邀测状态，如您需要使用该功能，请联系客户经理。|\
| | | |* 仅该对象为跨区域复制或同区域复制规则中源存储桶或目标存储桶的对象时，才会返回该参数。|\
| | | |* 仅支持查询配置了一条跨区域复制规则或同区域复制规则的源存储桶的对象复制状态，例如在源存储桶设置了多条复制规则，将 A 对象复制到 B、C、D 存储桶，则不支持查询 A 对象的复制状态。目标存储桶的对象则没有该限制。|\
| | | ||\
| | | |:::|
|x\-tos\-restore |String |ARCHIVE |如果对象为归档、冷归档或深度冷归档对象（即存储类型为 `ARCHIVE` 、`COLD_ARCHIVE` 或 `DEEP_COLD_ARCHIVE`），会返回副本删除时间，例如|\
| | | |`ongoing-request="false", expiry-date="Sat, 1 Jan 2022 00:00:00 GMT"`。 |
|x\-tos\-qos\-delay\-time |Integer |10 |该头域表示请求被流控时长，单位为 ms。上传类请求会返回精确的被流控的时长；copy 类请求或者下载类请求会返回根据流控程度和文件大小估算出的被流控的时长。 |
|x\-tos\-directory |Bool |true |如果桶类型为分层桶，且文件类型为目录时，会返回该头域。 |
|x\-tos\-create\-time |String |Mon, 02 Jul 2021 10:29:28 GMT |对象的创建日期。 |
|x\-tos\-object\-lock\-mode |String |COMPLIANCE |对象保留策略的模式，取值仅为 `COMPLIANCE`，表示合规模式。|\
| | | |:::tip|\
| | | |您的账号需要拥有 `GetObjectRetention` 权限，才会返回 `x-tos-object-lock-mode` 参数。|\
| | | ||\
| | | |:::|
|x\-tos\-object\-lock\-retain\-until\-date |String |2025\-01\-01T00:00:00Z |对象被锁定的截止日期，在该日期内，对象不能被删除或覆盖。|\
| | | |:::tip|\
| | | |您的账号需要拥有 `GetObjectRetention` 权限，才会返回 `x-tos-object-lock-retain-until-date` 参数。|\
| | | ||\
| | | |:::|

<span id="#.5ZON5bqU5YWD57Sg"></span>
## **响应元素**
该请求响应中无消息元素。
<span id="#.6K-35rGC56S65L6L"></span>
## **请求示例**
```JSON
GET /objectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
```

<span id="#.5ZON5bqU56S65L6L"></span>
## **响应示例**
```JSON
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 120
Date: Fri, 30 Jul 2021 08:05:36 GMT
ETag: "900150983cd24fb0d6963f7d28e17f72"
Last-Modified: Mon, 02 Jul 2021 10:29:28 GMT
server: TosServer
x-tos-id-2: d604607e63b001f-a444ed0
x-tos-request-id: d604607e63b001f-a444ed0
x-tos-hash-crc64ecma: 6186290338114851376

[ 120 Bytes object content]
```



