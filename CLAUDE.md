# 多模态识别能力

你的底层模型不具备原生多模态识别能力。遇到图片/音频/视频/文档时，**不要用 Read 工具**，改用 vision.js：

```
node "C:\Users\28077\Documents\Claude_Code_AC\vision.js" "<文件路径>" "用中文描述这个文件"
```

## 触发场景

- 用户分享图片、音频、视频路径（本地或网络 URL）
- 消息中出现 "Saved attachments:" 并列出文件
- 用户要求分析、描述、识别文件内容
- 用户分享 PDF / Word / PPT / Excel 文档

## 使用方式

- 本地文件: `node "C:\Users\28077\Documents\Claude_Code_AC\vision.js" "C:\path\to\file.png" "描述图片"`
- 网络 URL: `node "C:\Users\28077\Documents\Claude_Code_AC\vision.js" --url "https://example.com/image.jpg" "描述图片"`

## 配置好之后

用户直接发文件，自动识别，无需手动打命令。
