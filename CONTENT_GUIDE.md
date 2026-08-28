# 内容维护指南

这个站点把内容与页面布局分开管理。通常新增作品或经历只需增加 Markdown 文件和公开媒体，不必修改页面组件。

## 绘画作品

在 `src/content/artworks/` 新建 Markdown 文件：

```yaml
---
order: 6
title: 可选标题
image:
  src: /media/art/example
  alt: 对画面的简短、具体描述
tools: [数位板, 绘画软件]
featured: true
---
```

`order` 越小越靠前。`image.src` 不写扩展名，对应 `example-sm.webp` 与 `example-lg.webp` 两个文件。

## 经历与照片

在 `src/content/moments/` 新建 Markdown 文件：

```yaml
---
title: 一段经历的标题
date: 2026-08
order: 10
kind: event
tags: [朋友, 夏天]
collections: [journeys]
summary: 用一两句话概括这段经历。
cover:
  src: /media/moments/202608/example/cover
  alt: 对封面内容的简短、具体描述
images:
  - src: /media/moments/202608/example/cover
    alt: 对照片内容的简短、具体描述
featured: false
visibility: approved
---

这里填写正文，可以分成多个自然段。
```

- `kind` 可选 `making`、`event`、`portrait`、`note`。
- `collections` 可组合使用 `making`、`campus`、`journeys`、`celebrations`、`portraits`。
- 兽装制作条目可增加 `makingFor: self` 或 `makingFor: friend`。
- 同一个月份内按 `order` 从小到大排列。
- `visibility: draft` 的条目不会出现在公开页面。
- 没有照片的文字记录可以省略 `cover`，并将 `images` 写为 `[]` 或直接省略。
- 经历详情页会读取 `-lg.webp` 的真实宽高，自动按横图、竖图或近方图排版；无需手工填写尺寸。封面和其余图片都使用 `alt` 作为图下说明。
- `cover` 也可以同时出现在 `images` 中；详情页会自动去重，只展示一次。

## 媒体与隐私

公开图片使用 WebP，每个图片标识应有 `-sm.webp` 和 `-lg.webp` 两种尺寸。提交前应清除 EXIF、GPS、设备信息与不需要公开的文件名；描述朋友时默认不写昵称和账号，除非已经获得明确许可。

完成修改后运行：

```bash
pnpm validate
```

站点程序代码使用 MIT License；文字、绘画、照片、角色设定及其他内容不在 MIT 授权范围内。
