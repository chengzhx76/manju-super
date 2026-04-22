<span id="#.5Yqf6IO95o-P6L-w"></span>
## **功能描述**
此接口用于向桶中添加对象。要向桶中添加对象，必须对桶具有写权限。
TOS 是一个分布式系统。如果它同时收到针对同一对象的多个写请求，它将覆盖除最后一个写入对象以外的所有写请求。可以使用`Content-MD5`头带入期望的 MD5 值，与上传的对象的 MD5 值进行比较，如果不相等，则返回错误。
<span id="#.5pyN5Yqh56uv5Yqg5a-G"></span>
## 服务端加密
如果您使用服务端加密，TOS 在收到您上传的数据时，在文件级别加密这些数据，再将加密的数据持久化存储；您下载文件时，TOS 自动将加密数据解密后返回给您。关于服务端加密的更多详细信息，请参见[服务端加密概述](/docs/6349/105525)。
<span id="#acl"></span>
## ACL
您可以通过 headers 去设置对象的 ACL。所有的对象默认是私有的。您可以给某个账号或者预定义组授予对应的权限。关于 ACL 的更多详细信息，请参见 [ACL 策略概述](/docs/6349/102134)。
<span id="#.5a2Y5YKo57G75Z6L"></span>
## 存储类型
TOS 默认使用标准存储类型存储对象。标准存储类型是高可用、高可靠、高性能的存储类型。您也可以根据不同的使用场景，选择不同的存储类型。关于存储类型的更多详细信息，请参见[存储类型](/docs/6349/104493)。
<span id="#.5aSa54mI5pys"></span>
## 多版本
如果桶已开启多版本，新上传对象时会为对象自动生成一个唯一版本号，并在响应消息中通过头域 x\-tos\-version\-id 带回版本号。
如果桶暂停了多版本，新上传对象的版本号为 null，并且暂停后重复上传只会保留最新上传的对象。
<span id="#.6K-35rGC5raI5oGv5qC35byP"></span>
## **请求消息样式**
```JSON
PUT /objectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: GMT Date
Authorization: authorization string
Content-length: length

<put data>
```

<span id="#.6K-35rGC5Y-C5pWw5ZKM5raI5oGv5aS0"></span>
## **请求参数和消息头**
该请求使用的公共请求消息头，请参见[公共参数](/docs/6349/75044)。

|**名称** |**位置** |**参数类型** |**是否必选** |**示例值** |**说明** |
|---|---|---|---|---|---|
|Content\-Length |Header |Integer |是 |100 |消息体的大小。 |
|Content\-MD5 |Header |String |否 |XrY7u+Ae7tCTyyK7j1rNww== |消息体的 Base64MD5 摘要。 |
|Content\-Type |Header |String |否 |text/plain |对象类型。 |
|Cache\-Control |Header |String |否 |no\-cache, no\-store, must\-revalidate |指定该对象被下载时网页的缓存行为。 |
|Expires |Header |String |否 |Mon, 04 Jul 2022 02:57:31 GMT |RFC2616 中定义的缓存失效时间。 |
|Content\-Disposition |Header |String |否 |attachment; filename=123.txt |对象被下载时的名称。 |
|Content\-Encoding |Header |String |否 |gzip |对象被下载时的内容编码类型。 |
|Content\-Language |Header |String |否 |en\-US |对象被下载时的内容语言格式。 |
|x\-tos\-acl |Header |String |否 |private |对象的访问权限，有效的权限设置包括：|\
| | | | | ||\
| | | | | |* `private`：私有的。|\
| | | | | |* `public-read`：公共读。|\
| | | | | |* `public-read-write`：公共读写。|\
| | | | | |* `authenticated-read`：认证用户读。|\
| | | | | |* `bucket-owner-read` ：桶所有者读。|\
| | | | | |* `bucket-owner-full-control`：桶所有者完全权限。|\
| | | | | |* `bucket-owner-entrusted`：受桶策略控制，桶所有者完全权限。|\
| | | | | |* `default`：继承桶 ACL，即对象的 ACL 策略和桶 ACL 策略保持一致。 |
|x\-tos\-grant\-full\-control |Header |String |否 |id=123,id=456 |创建对象时，使用此头域授权用户具有对象的读（READ）、读（READ） ACP、写（WRITE） ACP 的权限。格式：id=账号1,id=账号2。 |
|x\-tos\-grant\-read |Header |String |否 |id=123,id=456 |允许被授权者读取对象和对象元数据的权限。格式：id=账号1,id=账号2。 |
|x\-tos\-grant\-read\-acp |Header |String |否 |id=123,id=456 |允许被授权者读取对象 ACL。格式：id=账号1,id=账号2。 |
|x\-tos\-grant\-write\-acp |Header |String |否 |id=123,id=456 |允许被授权者修改对象 ACL。格式：id=账号1,id=账号2。 |
|x\-tos\-meta\-\* |Header |String |否 |x\-tos\-meta\-key: value |创建对象时，可以在 HTTP 请求中加入以 x\-tos\-meta\-开头的消息头，用来加入自定义的元数据，以便对对象进行自定义管理。当用户获取此对象或查询此对象元数据时，加入的自定义元数据将会在返回消息的头中出现。 |
|x\-tos\-server\-side\-encryption |Header |String |否 |AES256 |设置目标对象的加密方式，如果未设置，默认为非加密对象，取值说明如下：|\
| | | | | ||\
| | | | | |* `AES256`：使用 SSE\-TOS 加密方式，并采用 AES256 加密算法。|\
| | | | | |* `SM4`：使用 SSE\-TOS 加密方式，并采用 SM4 加密算法。|\
| | | | | |* `kms`: 使用 SSE\-KMS 加密方式。|\
| | | | | |   关于 SSE\-TOS、 SSE\-KMS 加密方式详细说明，请参见[服务端加密概述](/docs/6349/74860)。|\
| | | | | ||\
| | | | | |:::tip|\
| | | | | |使用 SSE\-KMS 进行服务端加密会产生 API 调用费用，创建 KMS 密钥会产生密钥托管费用，由 KMS 收取，更多信息，请参见 [KMS 计费说明](../6476/71331)。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-server\-side\-data\-encryption |Header |String |否 |AES256 |使用 SSE\-KMS 加密方式时的加密算法，取值说明如下：|\
| | | | | ||\
| | | | | |* `AES256`： AES256 加密算法。|\
| | | | | |* `SM4`: SM4 加密算法。|\
| | | | | ||\
| | | | | |默认为 `AES256` 算法。 |
|x\-tos\-server\-side\-encryption\-kms\-key\-id |Header |String |否，使用 SSE\-KMS 加密时，必选。 |trn:kms:cn\-beijing:20000111:keyrings/ring\-test/keys/key\-test |指定 SSE\-KMS 加密目标对象使用的主密钥，格式如下：|\
| | | | | |`trn:kms:<region>:<accountID>:keyrings/<keyring>/keys/<key>`：KMS 主密钥的 TRN，其中 `region` 为使用密钥所属 Region ID，`accountID` 为密钥所属账号的 ID，`keyring` 为密钥环别名，`key` 为主密钥别名。|\
| | | | | |:::tip|\
| | | | | |目前不支持默认主密钥，如果指定 SSE\-KMS 加密而没有提供该头域，服务端会返回 `400 InvalidRequest` 错误。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-server\-side\-encryption\-customer\-algorithm |Header |String |否，使用 SSE\-C 加密时，必选。 |AES256 |指定 SSE\-C 加密对象要使用的算法，取值说明如下：|\
| | | | | ||\
| | | | | |* AES256：使用 AES256 算法加密对象。 |
|x\-tos\-server\-side\-encryption\-customer\-key |Header |String |否，使用 SSE\-C 加密时，必选。 |YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE= |与 `x-tos-server-side-encryption-customer-algorithm` 配套使用，指定 SSE\-C 加密目标对象的密钥，格式为 base64 编码的 256 bit 的加密密钥。 |
|x\-tos\-server\-side\-encryption\-customer\-key\-MD5 |Header |String |否，使用 SSE\-C 加密时，必选。 |0gYVWExOAz67jX5A6qY4+A== |与 x\-tos\-server\-side\-encryption\-customer\-key 配套使用，该头域表示加密对象使用的密钥的MD5值。该头域由密钥的 128\-bit MD5 值经过 base64\-encoded 得到，该值用于消息完整性检查，确认加密密钥在传输过程中没有出错。 |
|x\-tos\-website\-redirect\-location |Header |String |否 |/anotherObjectName |当桶设置了 Website 配置，可以将获取这个对象的请求重定向到桶内另一个对象或一个外部的 URL，TOS 将这个值从头域中取出，保存在对象的元数据中。 |
|x\-tos\-storage\-class |Header |String |否 |STANDARD |设置目的对象的存储类型。如果未设置，则目的对象的存储类型，和所在桶的默认存储类型保持一致，取值说明如下：|\
| | | | | ||\
| | | | | |* `STANDARD`：标准存储。|\
| | | | | |* `IA`：低频访问存储。|\
| | | | | |* `INTELLIGENT_TIERING`：智能分层存储。|\
| | | | | |* `ARCHIVE_FR`：归档闪回存储。|\
| | | | | |* `ARCHIVE`：归档存储。|\
| | | | | |* `COLD_ARCHIVE`：冷归档存储。|\
| | | | | |* `DEEP_COLD_ARCHIVE`：深度冷归档存储。|\
| | | | | |   :::tip|\
| | | | | |   * 当前仅华北2（北京）、华东2（上海）和华南1（广州）支持冷归档存储。|\
| | | | | |   * 当前仅华北2（北京）、华东2（上海）和华南1（广州）支持深度冷归档存储，且都处于邀测状态，如您需要使用该存储类型，请联系客户经理。|\
| | | | | ||\
| | | | | |   :::|
|x\-tos\-tagging |Header |String |否 |Key1=Value1&Key2=Value2 |设置对象的标签信息， 格式为 `{Key}={Value}`，支持同时设置多个标签，设置多个标签时使用 `&` 分隔。|\
| | | | | |:::tip|\
| | | | | ||\
| | | | | |* 对象标签的 Key 和 Value 需要先进行 URL 编码。|\
| | | | | |* 如果某个对象未使用 `=` 设置 Value，则 TOS 会认为该标签的 Value 为空字符串。|\
| | | | | |* 关于对象标签的更多限制信息，请参见[对象标签](/docs/6349/141325)。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-traffic\-limit |Header |String |否 |819200 |TOS 提供单链接限速功能，在上传、下载文件等操作中进行流控控制，以保证其他应用的网络带宽。取值说明如下：|\
| | | | | ||\
| | | | | |* 取值范围：245760\-838860800，单位为 bit/s。|\
| | | | | |* Header 和 Query 中不能同时存在此参数。 |
|x\-tos\-forbid\-overwrite |Header |String |否 |false |是否允许覆盖同名 Object，取值说明如下：|\
| | | | | ||\
| | | | | |* 不指定或者指定为 `false` ：表示允许覆盖同名 Object。|\
| | | | | |* 指定为 `true` 时：表示禁止覆盖同名 Object。|\
| | | | | ||\
| | | | | |:::warning|\
| | | | | |当目标 Bucket 处于已开启或已暂停的版本控制状态时，`x-tos-forbid-overwrite` 参数设置无效，即允许覆盖同名 Object。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-traffic\-limit |Query |String |否 |819200 |TOS 提供单链接限速功能，在上传、下载文件等操作中进行流控控制，以保证其他应用的网络带宽。取值说明如下：|\
| | | | | ||\
| | | | | |* 取值范围：245760\-838860800，单位为 bit/s。|\
| | | | | |* Header 和Query 中不能同时存在此参数。 |
|x\-tos\-object\-expires |Header |String |否 |3 |设置对象的过期时间，过期后，TOS 将自动删除对象。单位为天，支持设置为正整数，表示对象将在指定时间过期，从对象的 Last‑Modified 时间开始计算，在到达该过期时间后的零点开始执行删除任务。|\
| | | | | |例如设置 `x-tos-object-expires` 参数的值为 `3`，对象的 Last‑Modified 时间为 2024\-09\-26 12:00，则该对象将于 2024\-09\-30 00:00 过期。|\
| | | | | |:::tip|\
| | | | | ||\
| | | | | |* 对象过期时间优先级高于生命周期的删除规则，例如设置对象过期时间为 5 天，生命周期规则指定该对象 3 天后删除，最终将按照对象过期时间执行，即对象将于 5 天后被删除。|\
| | | | | |* TOS 支持通过 [GetObject](/docs/6349/74856)或 [HeadObject](/docs/6349/74864) 查询对象的过期时间。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-object\-lock\-mode |Header |String |否 |COMPLIANCE |保留策略的模式，取值仅为 `COMPLIANCE`，表示合规模式。|\
| | | | | |:::tip|\
| | | | | |为对象设置保留策略时，您需要先开启保留策略功能，详细介绍，请参见[PutBucketObjectLockConfiguration](/docs/6349/1764514)。|\
| | | | | ||\
| | | | | |:::|
|x\-tos\-object\-lock\-retain\-until\-date |Header |String |否 |2025\-01\-01T00:00:00Z |对象被锁定的截止日期，在该日期内，对象不能被删除或覆盖。遵循 ISO 8601 时间格式。|\
| | | | | |:::tip|\
| | | | | |`x-tos-object-lock-retain-until-date` 参数需要和 `x-tos-object-lock-mode` 参数一起使用。|\
| | | | | ||\
| | | | | |:::|
|if\-match |Header |String |否 |d41d8cd98f00b204e9800998ecf8427e |控制上传行为的 ETag 条件，只有当指定的 ETag 与存储桶中已有对象的 ETag 匹配时，才会上传对象。若指定的 ETag 不存在或不匹配，则上传对象会失败，并返回 412 状态码。 |
|if\-none\-match |Header |String |否 |d41d8cd98f00b204e9800998ecf8427e |控制上传行为的 ETag 条件，只有当指定的 ETag 与存储桶中已有对象的 ETag 不匹配时，才会上传对象。若存储桶中已有对象的 ETag 匹配指定的 ETag，则上传对象会失败，并返回 412 状态码。|\
| | | | | |:::tip|\
| | | | | |`if-none-match` 支持设置为 `*`，表示只要目标存储桶中存在同名对象（无论其 ETag 是什么），上传就会失败，并返回 412 状态码。|\
| | | | | ||\
| | | | | |:::|

<span id="#.6K-35rGC5YWD57Sg"></span>
## **请求元素**
该请求中无请求消息元素，请求体中带的是上传对象的数据内容。
<span id="#.5ZON5bqU5raI5oGv5aS0"></span>
## **响应消息头**
该请求返回的公共响应消息头，请参见[公共参数](/docs/6349/75044)。

|**名称** |**参数类型** |**示例值** |**说明** |
|---|---|---|---|
|x\-tos\-server\-side\-encryption |String |kms |对象是 SSE\-TOS 加密或 SSE\-KMS 时返回该头域，该头域表示对象的服务端加密方式，取值如下：|\
| | | ||\
| | | |* `AES256`：使用 SSE\-TOS 加密方式，并采用 AES256 加密算法。|\
| | | |* `SM4`：使用 SSE\-TOS 加密方式，并采用 SM4 加密算法。|\
| | | |* `kms`: 使用 SSE\-KMS 加密方式。|\
| | | |   关于 SSE\-TOS、 SSE\-KMS 加密方式详细说明，请参见[服务端加密概述](/docs/6349/105525)。 |
|x\-tos\-server\-side\-encryption\-kms\-key\-id |String |trn:kms:cn\-beijing:\*\*\*\*:keyrings/ring\-test/keys/key\-test |对象采用 SSE\-KMS 加密方式时返回该头域，该头域表示 SSE\-KMS 加密使用的 KMS 主密钥 ID。 |
|x\-tos\-server\-side\-encryption\-customer\-algorithm |String |AES256 |对象是 SSE\-C 加密时返回此头域，确认使用的加密算法。 |
|x\-tos\-server\-side\-encryption\-customer\-key\-MD5 |String |0gYVWExOAz67jX5A6qY4+A== |对象是 SSE\-C 加密时返回此头域，该头域表示加密使用的密钥的 MD5 值。 |
|x\-tos\-version\-id |String |57AF1A32CECB56721267 |对象的版本号。如果不存在版本号，则该消息头不会出现在响应消息中。 |
|x\-tos\-hash\-crc64ecma |Integer |6186290338114851376 |表示该对象的 64 位 CRC 值。该 64 位 CRC 根据 ECMA\-182 标准计算得出。|\
| | | |:::tip|\
| | | |当上传对象使用服务端加密时，该值为对象明文内容的 CRC64 校验值。|\
| | | ||\
| | | |:::|
|x\-tos\-qos\-delay\-time |Integer |10 |该头域表示请求被流控时长，单位为ms。上传类请求会返回精确的被流控的时长；copy类请求或者下载类请求会返回根据流控程度和文件大小估算出的被流控的时长。 |

<span id="#.5ZON5bqU5YWD57Sg"></span>
## **响应元素**
该请求响应中无消息元素。
<span id="#.6K-35rGC56S65L6L"></span>
## **请求示例**
```JSON
PUT /objectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
Content-Length: 100

[100 Byte data content]
```

<span id="#.5ZON5bqU56S65L6L"></span>
## **响应示例**
```JSON
HTTP/1.1 200 OK
x-tos-id-2: 367be10900210004-a444ed0
x-tos-request-id: 367be10900210004-a444ed0
Date: Fri, 30 Jul 2021 08:05:36 GMT
server: TosServer
Content-Length: 0
ETag: "1c06e540e11d65a51aeb724e72fa641a"
x-tos-hash-crc64ecma: 6186290338114851376
```



