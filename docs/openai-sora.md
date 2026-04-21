openai 创建视频，带图片

var myHeaders = new Headers();
myHeaders.append("Authorization", "Bearer <token>");

var formdata = new FormData();
formdata.append("model", "sora-2");
formdata.append("prompt", "A calico cat playing a piano on stage");
formdata.append("seconds", "4");
formdata.append("size", "720x1280");
formdata.append("input_reference", fileInput.files[0], "C:\Users\Administrator\Desktop\fuji-mountain-kawaguchiko-lake-morning-autumn-seasons-fuji-mountain-yamanachi-japan_副本.jpg");

var requestOptions = {
   method: 'POST',
   headers: myHeaders,
   body: formdata,
   redirect: 'follow'
};

fetch("https://api.antsk.cn/v1/videos", requestOptions)
   .then(response => response.text())
   .then(result => console.log(result))
   .catch(error => console.log('error', error));

openai 查询任务
var myHeaders = new Headers();
myHeaders.append("Accept", "application/json");
myHeaders.append("Authorization", "Bearer <token>");

var formdata = new FormData();

var requestOptions = {
   method: 'GET',
   headers: myHeaders,
   body: formdata,
   redirect: 'follow'
};

fetch("https://api.antsk.cn/v1/videos/sora-2:task_01k81e7r1mf0qtvp3ett3mr4jm", requestOptions)
   .then(response => response.text())
   .then(result => console.log(result))
   .catch(error => console.log('error', error));

#openai 下载视频
var myHeaders = new Headers();
myHeaders.append("Accept", "application/json");
myHeaders.append("Authorization", "Bearer <token>");

var formdata = new FormData();

var requestOptions = {
   method: 'GET',
   headers: myHeaders,
   body: formdata,
   redirect: 'follow'
};

fetch("https://api.antsk.cn/v1/videos/video_099c5197-abfd-4e16-88ff-1e162f2a5c77/content", requestOptions)
   .then(response => response.text())
   .then(result => console.log(result))
   .catch(error => console.log('error', error));