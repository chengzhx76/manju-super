# 素材中转 GoSDK 调用示例

## 目标

外部调用方继续使用 `github.com/volcengine/volcengine-go-sdk`，只修改请求 Host 到平台中转域名，即可调用素材接口中转能力。

## 接入要点

- 使用平台分配的 AK/SK（不是上游官方 AK/SK）
- SDK 配置 `WithEndpoint` 指向平台域名
- `ServiceName` 固定 `ark`
- `Version` 固定 `2024-01-01`
- `Action` 支持：
  - `ListAssetGroups`
  - `ListAssets`
  - `GetAsset`
  - `GetAssetGroup`
  - `UpdateAssetGroup`
  - `UpdateAsset`
  - `DeleteAsset`

## 示例 1：ListAssets

```go
package main

import (
	"fmt"

	"github.com/volcengine/volcengine-go-sdk/volcengine"
	"github.com/volcengine/volcengine-go-sdk/volcengine/credentials"
	"github.com/volcengine/volcengine-go-sdk/volcengine/session"
	"github.com/volcengine/volcengine-go-sdk/volcengine/universal"
)

func main() {
	platformAK := "YOUR_PLATFORM_AK"
	platformSK := "YOUR_PLATFORM_SK"
	region := "cn-beijing"
	relayEndpoint := "https://your-relay.example.com"

	cfg := volcengine.NewConfig().
		WithCredentials(credentials.NewStaticCredentials(platformAK, platformSK, "")).
		WithRegion(region).
		WithEndpoint(relayEndpoint)

	sess, err := session.NewSession(cfg)
	if err != nil {
		panic(err)
	}

	client := universal.New(sess)
	resp, err := client.DoCall(
		universal.RequestUniversal{
			ServiceName: "ark",
			Action:      "ListAssets",
			Version:     "2024-01-01",
			HttpMethod:  universal.POST,
			ContentType: universal.ApplicationJSON,
		},
		&map[string]any{
			"Filter": map[string]any{
				"GroupType": "AIGC",
				"Statuses":  []string{"Active"},
			},
			"PageNumber":  1,
			"PageSize":    10,
			"ProjectName": "default",
		},
	)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", resp)
}
```

## 示例 2：UpdateAssetGroup

```go
package main

import (
	"fmt"

	"github.com/volcengine/volcengine-go-sdk/volcengine"
	"github.com/volcengine/volcengine-go-sdk/volcengine/credentials"
	"github.com/volcengine/volcengine-go-sdk/volcengine/session"
	"github.com/volcengine/volcengine-go-sdk/volcengine/universal"
)

func main() {
	platformAK := "YOUR_PLATFORM_AK"
	platformSK := "YOUR_PLATFORM_SK"
	region := "cn-beijing"
	relayEndpoint := "https://your-relay.example.com"

	cfg := volcengine.NewConfig().
		WithCredentials(credentials.NewStaticCredentials(platformAK, platformSK, "")).
		WithRegion(region).
		WithEndpoint(relayEndpoint)

	sess, err := session.NewSession(cfg)
	if err != nil {
		panic(err)
	}

	client := universal.New(sess)
	resp, err := client.DoCall(
		universal.RequestUniversal{
			ServiceName: "ark",
			Action:      "UpdateAssetGroup",
			Version:     "2024-01-01",
			HttpMethod:  universal.POST,
			ContentType: universal.ApplicationJSON,
		},
		&map[string]any{
			"Id":          "group-2026xxxxxxxxxx-xxxxx",
			"Name":        "my-group-name",
			"Description": "updated by relay",
			"ProjectName": "default",
		},
	)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", resp)
}
```

## 说明

- 在共享上游 `AK/SK + ProjectName` 场景下，平台会做多租户过滤与隔离，列表接口会重写 `TotalCount` 为租户可见数量。
- `UpdateAssetGroup` 的 `Name` 在平台内部会进行租户前缀策略处理，上游写入名与对外展示名可能不同。
- 若开启缓存，`List/Get` 为短 TTL 缓存；`Update/Delete` 成功后会触发缓存失效版本递增。

## 最小可运行 Demo

- 代码文件：`d:\go_project\src\volcengine2api\.trae\docs\code\AssetRelay_GoSDK_Demo.go`
- 运行前设置环境变量：
  - `PLATFORM_AK`
  - `PLATFORM_SK`
  - `RELAY_ENDPOINT`（如 `https://relay.example.com`）
  - `REGION`（可选，默认 `cn-beijing`）
  - `GROUP_ID`（GetAssetGroup / UpdateAssetGroup 必填）
  - `ASSET_ID`（GetAsset / UpdateAsset / DeleteAsset 必填）
- 运行示例：
  - `go run .trae/docs/code/AssetRelay_GoSDK_Demo.go ListAssets`
  - `go run .trae/docs/code/AssetRelay_GoSDK_Demo.go GetAsset`
  - `go run .trae/docs/code/AssetRelay_GoSDK_Demo.go UpdateAssetGroup`
