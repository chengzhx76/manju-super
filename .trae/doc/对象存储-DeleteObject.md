<span id="功能描述"></span>
## **功能描述**
此接口用于删除桶中指定的对象。
当桶的多版本状态是开启时，调用此接口如果不指定版本删除，不会删除对象，将会产生一个新的版本号，并插入删除标记（DeleteMarker）；当桶的多版本状态是 `Suspended` 时，删除版本为`null`的对象，并产生一个版本为 `null` 的删除标记。多版本状态下，指定版本删除将删除指定版本号的对象。
<span id="请求消息样式"></span>
## **请求消息样式**
```JSON
DELETE /ObjectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: GMT Date
Authorization: authorization string
```

<span id="请求参数和消息头"></span>
## **请求参数和消息头**
该请求使用公共请求消息头，请参见[公共参数](/docs/6349/75044)。

| | | | | | | \
|**名称** |**位置** |**参数类型** |**是否必选** |**示例值** |**说明** |
|---|---|---|---|---|---|
| | | | | | | \
|versionId |Query |String |否 |5840E600C6FBD446792D |待删除对象的版本号。 |
| | | | | | | \
|recursive |Query |String |否 |true |递归删除非空目录。取值为 `true` 时，表示该功能生效，说明如下： |\
| | | | | | |\
| | | | | |* 删除文件携带 `recursive`，则忽略该字段。 |\
| | | | | |* 开启回收站后，删除非空目录必须携带 `recursive`。 |\
| | | | | | |\
| | | | | |:::warning |\
| | | | | |该参数仅支持在开启回收站功能的分层命名空间使用，回收站功能详情请参见[回收站](/docs/6349/1458171)。 |\
| | | | | |::: |
| | | | | | | \
|skipTrash |Query |String |否 |true |是否跳过回收站彻底删除，取值说明如下： |\
| | | | | | |\
| | | | | |* `true`：表示跳过回收站彻底删除。 |\
| | | | | |* `false`：表示不跳过回收站，删除的对象会先进入回收站。 |\
| | | | | | |\
| | | | | |:::warning |\
| | | | | |该参数仅支持在开启回收站功能的分层命名空间使用，回收站功能详情请参见[回收站](/docs/6349/1458171)。 |\
| | | | | |::: |

<span id="请求元素"></span>
#### **请求元素**
该请求不使用消息元素。
<span id="响应消息头"></span>
## **响应消息头**
该请求返回的公共响应消息头，请参见[公共参数](/docs/6349/75044)。

| | | | | \
|**名称** |**参数类型** |**示例值** |**说明** |
|---|---|---|---|
| | | | | \
|x-tos-delete-marker |Bool |true |标识对象是否标记删除。如果不是，则响应中不会出现该消息头。 |
| | | | | \
|x-tos-version-id |String |5840E600C6FBD446792D |对象的版本号。如果该对象无版本号，则响应中不会出现该消息头。 |
| | | | | \
|x-tos-trash-path |String |.Trash/20250107070000/file |文件或者目录被移入回收站后的实际路径。 |

<span id="响应元素"></span>
## **响应元素**
该请求响应中无消息元素。
<span id="请求示例"></span>
## **请求示例1**
删除对象（未开启回收站）。
```JSON
DELETE /objectName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
```

<span id="响应示例"></span>
## **响应示例1**
```JSON
HTTP/1.1 204 No Content
Date: Fri, 30 Jul 2021 08:05:36 GMT
Server: TosServer
x-tos-id-2: 1e89f203b2d00006-a444ed0
x-tos-request-id: 1e89f203b2d00006-a444ed0
```

<span id="d782db49"></span>
## **请求示例2**
开启回收站后，删除文件 `fileName`，文件进入回收站，回收站中的路径：`.Trash/20250107070000/fileName`。
```JSON
DELETE /fileName HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
```

<span id="a6dc7810"></span>
## **响应示例2**
```JSON
HTTP/1.1 204 No Content
Date: Fri, 30 Jul 2021 08:05:36 GMT
Server: TosServer
x-tos-id-2: 1e89f203b2d00006-a444ed0
x-tos-request-id: 1e89f203b2d00006-a444ed0
x-tos-trash-path: .Trash/20250107070000/fileName
```

<span id="6a810442"></span>
## **请求示例3**
开启回收站后，携带 `recursive=true` 递归删除目录，目录进入回收站，回收站中的路径：`.Trash/20250107070000/dirName`。
```JSON
DELETE /dirName?recursive=true HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
```

<span id="8dee281c"></span>
## **响应示例3**
```JSON
HTTP/1.1 204 No Content
Date: Fri, 30 Jul 2021 08:05:36 GMT
Server: TosServer
x-tos-id-2: 1e89f203b2d00006-a444ed0
x-tos-request-id: 1e89f203b2d00006-a444ed0
x-tos-trash-path: .Trash/20250107070000/dirName
```

<span id="ccc6a015"></span>
## **请求示例4**
开启回收站后，携带 `skipTrash=true` 跳过回收站删除文件，文件被彻底删除。
```JSON
DELETE /fileName?skipTrash=true HTTP/1.1
Host: bucketname.tos-cn-beijing.volces.com
Date: Fri, 30 Jul 2021 08:05:36 GMT
Authorization: authorization string
```

<span id="4cdbeab0"></span>
## **响应示例4**
```JSON
HTTP/1.1 204 No Content
Date: Fri, 30 Jul 2021 08:05:36 GMT
Server: TosServer
x-tos-id-2: 1e89f203b2d00006-a444ed0
x-tos-request-id: 1e89f203b2d00006-a444ed0
```

<span id="4cd7093b"></span>
## 
