      
<?php
/**
 * Copyright (year) Beijing Volcano Engine Technology Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require 'vendor/autoload.php';

// 需要自行安装 Composer（https://getcomposer.org/doc/00-intro.md），并安装GuzzleHttp依赖，运行以下命令：composer require guzzlehttp/guzzle:^7.0
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

$Service = "ark";
$Version = "2024-01-01";
$Region = "cn-beijing";
$Host = "ark.cn-beijing.volcengineapi.com";
$ContentType = "application/json";

/**
 * 创建一个 API 请求函数。签名计算的过程包含在该函数中。
 * 
 * @param string $method 请求方法 (GET, POST 等)
 * @param array $query 查询参数
 * @param array $header 请求头
 * @param string $ak AccessKeyID
 * @param string $sk SecretAccessKey
 * @param string $action API Action
 * @param string $body 请求体 (JSON字符串)
 * @return \Psr\Http\Message\ResponseInterface
 * @throws GuzzleException
 */
function request($method, $query, $header, $ak, $sk, $action, $body)
{
    global $Service, $Region, $Host, $Version, $ContentType;
    $credential = [
        'accessKeyId' => $ak,
        'secretKeyId' => $sk,
        'service' => $Service,
        'region' => $Region,
    ];

    // 初始化签名结构体
    $query = array_merge($query, [
      'Action' => $action,
      'Version' => $Version
    ]);
    ksort($query);
    $requestParam = [
        'body' => $body,
        'host' => $Host,
        'path' => '/',
        'method' => $method,
        'contentType' => $ContentType,
        'date' => gmdate('Ymd\THis\Z'),
        'query' => $query
    ];

    // 开始计算签名。在计算签名前，准备好用于接收计算结果的 signResult 变量，并设置一些参数。
    $xDate = $requestParam['date'];
    $shortXDate = substr($xDate, 0, 8);
    $xContentSha256 = hash('sha256', $requestParam['body']);
    $signResult = [
        'Host' => $requestParam['host'],
        'X-Content-Sha256' => $xContentSha256,
        'X-Date' => $xDate,
        'Content-Type' => $requestParam['contentType']
    ];

    // 计算 Signature 签名。
    $signedHeaderStr = join(';', ['content-type', 'host', 'x-content-sha256', 'x-date']);
    $canonicalRequestStr = join("\n", [
        $requestParam['method'],
        $requestParam['path'],
        http_build_query($requestParam['query']),
        join("\n", ['content-type:' . $requestParam['contentType'], 'host:' . $requestParam['host'], 'x-content-sha256:' . $xContentSha256, 'x-date:' . $xDate]),
        '',
        $signedHeaderStr,
        $xContentSha256
    ]);
    $hashedCanonicalRequest = hash("sha256", $canonicalRequestStr);
    $credentialScope = join('/', [$shortXDate, $credential['region'], $credential['service'], 'request']);
    $stringToSign = join("\n", ['HMAC-SHA256', $xDate, $credentialScope, $hashedCanonicalRequest]);
    $kDate = hash_hmac("sha256", $shortXDate, $credential['secretKeyId'], true);
    $kRegion = hash_hmac("sha256", $credential['region'], $kDate, true);
    $kService = hash_hmac("sha256", $credential['service'], $kRegion, true);
    $kSigning = hash_hmac("sha256", 'request', $kService, true);
    $signature = hash_hmac("sha256", $stringToSign, $kSigning);
    $signResult['Authorization'] = sprintf("HMAC-SHA256 Credential=%s, SignedHeaders=%s, Signature=%s", $credential['accessKeyId'] . '/' . $credentialScope, $signedHeaderStr, $signature);
    $header = array_merge($header, $signResult);

    // 将 Signature 签名写入 HTTP Header 中，并发送 HTTP 请求。
    $client = new Client([
        'base_uri' => 'https://' . $requestParam['host'],
        'timeout' => 120.0,
    ]);
    return $client->request($method, 'https://' . $requestParam['host'] . $requestParam['path'], [
        'headers' => $header,
        'query' => $requestParam['query'],
        'body' => $requestParam['body']
    ]);
}

$requestBody = json_encode([
    "GroupId" => "group-202xxxxxxxxxxxxtk",
    "URL" => "https://ark-project.tos-cn-beijing.volces.com/doc_image/i2v_foxrgirl.png",
    "AssetType" => "Image",
    "ProjectName" => "default"
]);

$AK = ''; // 请确保 AK 安全性
$SK = ''; // 请确保 SK 安全性

try {
    $response = request("POST", [], [], $AK, $SK, "CreateAsset", $requestBody);
    echo "==================================================\n";
    echo "正在发起请求: Action=CreateAsset, Version=2024-01-01\n";
    echo "请求体: {$requestBody}\n";
    echo "==================================================\n";
    echo "响应状态码: " . $response->getStatusCode() . "\n";
    echo "响应内容:\n";
    $body = $response->getBody()->getContents();
    $decodedBody = json_decode($body, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo json_encode($decodedBody, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    } else {
        echo $body . "\n";
    }
} catch (GuzzleException $e) {
    echo "响应内容:\n";
    echo $e->getMessage() . "\n";
}
?>

    