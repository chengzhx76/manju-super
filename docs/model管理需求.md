现在的模型是配置固定的 api.antsk.cn
我希望增加一个模型管理的菜单，可以动态的管理和配置模型，包括对话模型、画图模型、和视频模型，因为有可能要用其他渠道商。
但我希望默认还是使用 api.antsk.cn，可以增加折扣广告，因为这是我的开源项目，我是靠api.antsk.cn 的模型盈利。

对话模型使用 /v1/chat/completions
画图模型使用 
/v1beta/models/gemini-3-pro-image-preview:generateContent

视频模型，如果是sora 使用v1/video
如果是veo使用 /v1/chat/completions

另外现在图片和视频生成只有横屏，我希望可以增加竖屏的视频生成功能，

# 视频和图片生成 API 横竖屏参数说明

## 概述

本文档说明项目中三个主要 API（Gemini Image、Sora-2、Veo 3.1）如何处理横屏和竖屏的请求参数。

---

## 1. Gemini Image API（图片生成）

### 文件位置
- 封装模块：`web/js/gemini-api.js`
- 使用页面：`web/js/gemini-image.js`

### 支持的比例
- **横屏**：`16:9`（默认）
- **竖屏**：`9:16`
- **注意**：Gemini 3 Pro Image 不支持方形 `1:1`

### 请求方式

#### 参数配置
```javascript
const requestBody = {
    contents: [{
        role: "user",
        parts: parts  // 包含图片和文本
    }],
    generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
    }
};
```

#### 横屏（默认）
横屏是默认模式，**不需要额外配置**：

```javascript
// 横屏请求 - 不需要 imageConfig
GeminiImageAPI.generateImage({
    apiKey: apiKey,
    images: uploadedImages,
    prompt: prompt,
    aspectRatio: '16:9'  // 可选，默认就是横屏
});
```

实际请求体：
```json
{
    "contents": [{
        "role": "user",
        "parts": [...]
    }],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"]
    }
}
```

#### 竖屏
竖屏需要在 `generationConfig` 中添加 `imageConfig` 配置：

```javascript
// 竖屏请求 - 需要 imageConfig
GeminiImageAPI.generateImage({
    apiKey: apiKey,
    images: uploadedImages,
    prompt: prompt,
    aspectRatio: '9:16'  // 指定竖屏
});
```

实际请求体：
```json
{
    "contents": [{
        "role": "user",
        "parts": [...]
    }],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"],
        "imageConfig": {
            "aspectRatio": "9:16"
        }
    }
}
```

### 核心代码逻辑

在 `gemini-api.js` 中的实现：

```javascript
// 如果是竖屏(9:16)，添加imageConfig配置
if (aspectRatio === '9:16') {
    requestBody.generationConfig.imageConfig = {
        aspectRatio: '9:16'
    };
}
```

### API 端点
```
POST https://api.antsk.cn/v1beta/models/gemini-3-pro-image-preview:generateContent
```

### 完整 curl 示例

#### 横屏图片生成（默认，纯文本提示词）
```bash
curl -X POST "https://api.antsk.cn/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{
        "text": "一只可爱的橘猫坐在窗台上看着外面，阳光洒在它的毛发上，温馨的室内场景"
      }]
    }],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"]
    }
  }'
```

#### 竖屏图片生成（需要 imageConfig）
```bash
curl -X POST "https://api.antsk.cn/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{
        "text": "一位穿着和服的日本女孩站在樱花树下，花瓣飘落，竖屏构图"
      }]
    }],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"],
      "imageConfig": {
        "aspectRatio": "9:16"
      }
    }
  }'
```

#### 带参考图片的图片生成（横屏）
```bash
curl -X POST "https://api.antsk.cn/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {
          "inlineData": {
            "mimeType": "image/png",
            "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          }
        },
        {
          "text": "基于这张图片，生成一个更加梦幻的版本，添加彩虹和星光效果"
        }
      ]
    }],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"]
    }
  }'
```

**响应示例：**
```json
{
  "candidates": [{
    "content": {
      "parts": [
        {
          "text": "生成的图片描述文本..."
        },
        {
          "inlineData": {
            "mimeType": "image/png",
            "data": "base64编码的图片数据..."
          }
        }
      ]
    }
  }]
}
```

---

## 2. Sora-2 API（视频生成）

### 文件位置
- 封装模块：`web/js/sora-api.js`
- 使用页面：`web/js/video-manga.js`、`web/js/ai-video-content.js`

### 支持的比例
- **横屏**：`16:9` → `1280x720`
- **竖屏**：`9:16` → `720x1280`
- **方形**：`1:1` → `720x720`

### 支持的时长
- `4` 秒
- `8` 秒（默认）
- `12` 秒

### 请求方式

Sora-2 使用 **FormData** 形式的异步 API：

```javascript
const formData = new FormData();
formData.append('model', 'sora-2');
formData.append('prompt', prompt);
formData.append('seconds', String(duration));  // 4, 8 或 12
formData.append('size', size);  // 例如 '1280x720'
```

#### 横屏
```javascript
SoraAPI.generateVideo({
    apiKey: apiKey,
    prompt: prompt,
    duration: 8,           // 4, 8 或 12 秒
    aspectRatio: '16:9',   // 横屏
    referenceImage: referenceImage
});
```

实际请求参数：
```
model: sora-2
prompt: [视频描述]
seconds: 8
size: 1280x720
```

#### 竖屏
```javascript
SoraAPI.generateVideo({
    apiKey: apiKey,
    prompt: prompt,
    duration: 8,
    aspectRatio: '9:16',   // 竖屏
    referenceImage: referenceImage
});
```

实际请求参数：
```
model: sora-2
prompt: [视频描述]
seconds: 8
size: 720x1280
```

### 核心代码逻辑

#### 1. 宽高比映射
```javascript
function getSize(aspectRatio) {
    const sizeMap = {
        '16:9': '1280x720',   // 横屏
        '9:16': '720x1280',   // 竖屏
        '1:1': '720x720'      // 方形
    };
    return sizeMap[aspectRatio] || sizeMap['16:9'];
}
```

#### 2. 时长验证
```javascript
function getValidDuration(duration) {
    const supported = [4, 8, 12];  // Sora-2 支持的时长
    if (supported.includes(duration)) {
        return duration;
    }
    // 自动调整到最接近的支持时长
    // ...
}
```

### API 端点

1. **创建任务**：
```
POST https://api.antsk.cn/v1/videos
```

2. **查询状态**：
```
GET https://api.antsk.cn/v1/videos/{taskId}
```

3. **获取视频**：
```
GET https://api.antsk.cn/v1/videos/{videoId}/content
```

### 完整 curl 示例

#### 步骤 1：创建横屏视频任务（16:9，8秒，纯文本）
```bash
curl -X POST "https://api.antsk.cn/v1/videos" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=一只橘猫在阳光明媚的花园里追逐蝴蝶，慢动作拍摄，电影级画质" \
  -F "seconds=8" \
  -F "size=1280x720"
```

**响应：**
```json
{
  "id": "task_abc123xyz",
  "status": "pending",
  "created_at": "2026-02-03T10:30:00Z"
}
```

#### 步骤 1（变体）：创建竖屏视频任务（9:16，12秒，带参考图）
```bash
# 需要先准备参考图片文件 reference.png
curl -X POST "https://api.antsk.cn/v1/videos" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=从这张照片开始，镜头缓慢推进，背景逐渐虚化，呈现出梦幻般的氛围" \
  -F "seconds=12" \
  -F "size=720x1280" \
  -F "input_reference=@reference.png"
```

#### 步骤 2：轮询查询任务状态
```bash
curl -X GET "https://api.antsk.cn/v1/videos/task_abc123xyz" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**响应（处理中）：**
```json
{
  "id": "task_abc123xyz",
  "status": "processing",
  "progress": 45
}
```

**响应（完成）：**
```json
{
  "id": "task_abc123xyz",
  "status": "completed",
  "output": {
    "video_id": "video_xyz789abc",
    "url": "https://cdn.example.com/videos/video_xyz789abc.mp4"
  }
}
```

#### 步骤 3：获取视频内容
```bash
# 方式1: 通过 content 接口获取
curl -X GET "https://api.antsk.cn/v1/videos/video_xyz789abc/content" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o output_video.mp4

# 方式2: 直接下载 URL（如果API返回了直接URL）
curl -o output_video.mp4 "https://cdn.example.com/videos/video_xyz789abc.mp4"
```

#### 完整流程示例（Bash脚本）
```bash
#!/bin/bash

API_KEY="YOUR_API_KEY"
API_BASE="https://api.antsk.cn/v1"

# 1. 创建任务
echo "创建视频生成任务..."
RESPONSE=$(curl -s -X POST "$API_BASE/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=sora-2" \
  -F "prompt=一只小狗在海滩上奔跑，夕阳西下" \
  -F "seconds=8" \
  -F "size=1280x720")

TASK_ID=$(echo $RESPONSE | jq -r '.id')
echo "任务ID: $TASK_ID"

# 2. 轮询状态
while true; do
  sleep 3
  STATUS_RESPONSE=$(curl -s -X GET "$API_BASE/videos/$TASK_ID" \
    -H "Authorization: Bearer $API_KEY")
  
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  echo "当前状态: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    VIDEO_ID=$(echo $STATUS_RESPONSE | jq -r '.output.video_id')
    echo "视频生成完成！视频ID: $VIDEO_ID"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "视频生成失败"
    exit 1
  fi
done

# 3. 下载视频
echo "下载视频..."
curl -X GET "$API_BASE/videos/$VIDEO_ID/content" \
  -H "Authorization: Bearer $API_KEY" \
  -o "generated_video.mp4"

echo "视频已保存到 generated_video.mp4"
```

---

## 3. Veo 3.1 API（视频生成）

### 文件位置
- 使用页面：`web/js/video-manga.js`、`web/js/ai-video-content.js`

### 支持的比例
- **横屏**：`16:9`（landscape）
- **竖屏**：`9:16`（portrait）
- **不支持**：`1:1`（方形）

### 请求方式

Veo 3.1 使用 **chat/completions** API，模型名称中包含横竖屏标识：

#### 模型命名规则
```
veo_3_1_{type}_fast_{orientation}
```

- `{type}`: 
  - `t2v`：文本生成视频（Text to Video）
  - `i2v_s_fast_fl`：图片生成视频（Image to Video）
- `{orientation}`:
  - `landscape`：横屏
  - `portrait`：竖屏

#### 横屏（有参考图）
```javascript
// 模型名称
const model = 'veo_3_1_i2v_s_fast_fl_landscape';

// 请求体
{
    model: 'veo_3_1_i2v_s_fast_fl_landscape',
    stream: false,
    messages: [{
        role: 'user',
        content: [
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${base64Data}`
                }
            },
            {
                type: 'text',
                text: prompt
            }
        ]
    }]
}
```

#### 竖屏（有参考图）
```javascript
// 模型名称
const model = 'veo_3_1_i2v_s_fast_fl_portrait';

// 请求体结构相同，只是 model 字段改为 portrait
{
    model: 'veo_3_1_i2v_s_fast_fl_portrait',
    // ... 其他参数相同
}
```

#### 横屏（无参考图）
```javascript
// 模型名称
const model = 'veo_3_1_t2v_fast_landscape';

// 请求体
{
    model: 'veo_3_1_t2v_fast_landscape',
    stream: false,
    messages: [{
        role: 'user',
        content: [{
            type: 'text',
            text: prompt
        }]
    }]
}
```

#### 竖屏（无参考图）
```javascript
// 模型名称
const model = 'veo_3_1_t2v_fast_portrait';

// 请求体结构相同，只是 model 字段改为 portrait
```

### 核心代码逻辑

在 `ai-video-content.js` 中的实现：

```javascript
function getActualModelName(baseModel, hasImages, aspectRatio) {
    if (baseModel === 'veo') {
        // Veo模型：根据横竖屏选择后缀（landscape/portrait）
        // Veo 不支持 1:1，只支持横屏(16:9)和竖屏(9:16)
        const isPortrait = aspectRatio === '9:16';
        const suffix = isPortrait ? 'portrait' : 'landscape';
        return hasImages 
            ? `veo_3_1_i2v_s_fast_fl_${suffix}`  // image to video
            : `veo_3_1_t2v_fast_${suffix}`;      // text to video
    }
    return baseModel;
}
```

### API 端点
```
POST https://api.antsk.cn/v1/chat/completions
```

### 完整 curl 示例

#### 横屏视频 - 文本生成（Text to Video）
```bash
curl -X POST "https://api.antsk.cn/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "veo_3_1_t2v_fast_landscape",
    "stream": false,
    "messages": [{
      "role": "user",
      "content": [{
        "type": "text",
        "text": "一只金毛犬在公园里快乐地奔跑，镜头跟随拍摄，阳光明媚的下午，草地绿意盎然，8秒视频，横屏16:9"
      }]
    }],
    "temperature": 0.7
  }'
```

#### 竖屏视频 - 文本生成（Text to Video）
```bash
curl -X POST "https://api.antsk.cn/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "veo_3_1_t2v_fast_portrait",
    "stream": false,
    "messages": [{
      "role": "user",
      "content": [{
        "type": "text",
        "text": "一位年轻女孩在咖啡店里微笑着喝咖啡，竖屏拍摄，温馨的室内氛围，柔和的光线，8秒短视频"
      }]
    }],
    "temperature": 0.7
  }'
```

#### 横屏视频 - 图片生成（Image to Video，单张参考图）
```bash
curl -X POST "https://api.antsk.cn/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "veo_3_1_i2v_s_fast_fl_landscape",
    "stream": false,
    "messages": [{
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          }
        },
        {
          "type": "text",
          "text": "从这张照片开始，镜头缓慢推进，人物微笑并向镜头挥手，保持自然的动作，横屏16:9，8秒视频"
        }
      ]
    }],
    "temperature": 0.7
  }'
```

#### 竖屏视频 - 图片生成（Image to Video，多张参考图）
```bash
curl -X POST "https://api.antsk.cn/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "veo_3_1_i2v_s_fast_fl_portrait",
    "stream": false,
    "messages": [{
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,BASE64_START_FRAME_DATA"
          }
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,BASE64_END_FRAME_DATA"
          }
        },
        {
          "type": "text",
          "text": "请生成视频：从第一张图片的姿态开始，平滑过渡到第二张图片的姿态，保持人物特征一致，竖屏9:16，8秒"
        }
      ]
    }],
    "temperature": 0.7
  }'
```

**响应示例：**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1738569000,
  "model": "veo_3_1_i2v_s_fast_fl_landscape",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "https://cdn.example.com/videos/generated_video.mp4"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

**注意：** Veo 3.1 的响应可能直接返回视频URL在 `content` 字段中，也可能返回 base64 编码的视频数据。

---

## 对比总结

| API | 横屏配置 | 竖屏配置 | 方形支持 | 配置方式 |
|-----|---------|---------|---------|---------|
| **Gemini Image** | `16:9`（默认，无需配置） | 在 `generationConfig.imageConfig` 中添加 `aspectRatio: "9:16"` | ❌ 不支持 | 请求体字段 |
| **Sora-2** | `size: "1280x720"` | `size: "720x1280"` | `size: "720x720"` | FormData 参数 |
| **Veo 3.1** | 模型名 `*_landscape` | 模型名 `*_portrait` | ❌ 不支持 | 模型名称 |

### 关键差异

1. **Gemini Image**：
   - 横屏是默认行为，不需要特殊配置
   - 竖屏需要在 `generationConfig` 中添加 `imageConfig` 对象

2. **Sora-2**：
   - 通过 `size` 参数直接指定像素尺寸
   - 支持三种比例（16:9、9:16、1:1）
   - 支持多种时长（4、8、12 秒）

3. **Veo 3.1**：
   - 通过**模型名称**区分横竖屏（landscape/portrait）
   - 只支持两种比例（16:9、9:16）
   - 时长固定为 8-10 秒

---

## 代码示例

### Gemini Image - 完整示例

```javascript
// 横屏（默认）
const horizontalImage = await GeminiImageAPI.generateImage({
    apiKey: 'your-api-key',
    prompt: '一只可爱的猫咪',
    aspectRatio: '16:9'  // 可省略，默认横屏
});

// 竖屏
const verticalImage = await GeminiImageAPI.generateImage({
    apiKey: 'your-api-key',
    prompt: '一只可爱的猫咪',
    aspectRatio: '9:16'  // 必须指定
});
```

### Sora-2 - 完整示例

```javascript
// 横屏视频
const horizontalVideo = await SoraAPI.generateVideo({
    apiKey: 'your-api-key',
    prompt: '猫咪在花园里玩耍',
    duration: 8,
    aspectRatio: '16:9',
    referenceImage: {
        base64: 'base64Data...',
        mimeType: 'image/png'
    }
});

// 竖屏视频
const verticalVideo = await SoraAPI.generateVideo({
    apiKey: 'your-api-key',
    prompt: '猫咪在花园里玩耍',
    duration: 8,
    aspectRatio: '9:16',
    referenceImage: {
        base64: 'base64Data...',
        mimeType: 'image/png'
    }
});
```

### Veo 3.1 - 完整示例

```javascript
// 横屏视频（有图片）
const horizontalVideoWithImage = await fetch('https://api.antsk.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        model: 'veo_3_1_i2v_s_fast_fl_landscape',  // 横屏
        messages: [{
            role: 'user',
            content: [
                { type: 'image_url', image_url: { url: imageDataUrl } },
                { type: 'text', text: prompt }
            ]
        }]
    })
});

// 竖屏视频（无图片）
const verticalVideoTextOnly = await fetch('https://api.antsk.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        model: 'veo_3_1_t2v_fast_portrait',  // 竖屏
        messages: [{
            role: 'user',
            content: [{ type: 'text', text: prompt }]
        }]
    })
});
```

---

## 注意事项

1. **Gemini Image**：
   - 竖屏模式必须显式配置 `imageConfig`
   - 横屏模式可以省略配置，使用默认值

2. **Sora-2**：
   - 必须使用支持的时长（4、8、12 秒），否则会自动调整
   - 参考图片会自动调整为目标视频尺寸

3. **Veo 3.1**：
   - 不支持 1:1 方形视频
   - 必须根据是否有参考图和横竖屏选择正确的模型名称
   - 时长固定，不可调整

4. **统一建议**：
   - 优先使用常量或枚举定义比例参数，避免硬编码
   - 在用户界面中提供清晰的横竖屏选项
   - 对不支持的比例进行友好的错误提示

---

## 相关文件

- `web/js/gemini-api.js` - Gemini Image API 封装
- `web/js/gemini-image.js` - Gemini Image 页面逻辑
- `web/js/sora-api.js` - Sora-2 API 封装
- `web/js/ai-video-content.js` - AI 视频生成页面（支持 Sora-2 和 Veo 3.1）
- `web/js/video-manga.js` - 视频漫剧生成页面（支持 Sora-2 和 Veo 3.1）

---

*文档生成时间：2026年2月3日*
