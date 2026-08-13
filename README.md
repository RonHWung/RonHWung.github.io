# 茸磺 / RonHWung

茸磺的个人主页：绘画、兽装制作、角色设定与沿途记录。

## 本地开发

```bash
pnpm install
pnpm dev
```

默认访问 `http://localhost:4321/`。局域网预览可运行：

```bash
pnpm dev --host
```

## 内容维护

- `src/content/artworks/`：绘画作品
- `src/content/moments/`：活动与生活片段
- `public/media/`：经过网页优化并清除元数据的公开图片

内容通过 Astro Content Collections 校验。调整同一个月内的时间线顺序时，修改条目的 `order` 数字即可。字段说明与新增示例见 [CONTENT_GUIDE.md](./CONTENT_GUIDE.md)。

发布前可运行 `pnpm validate`，它会执行类型检查、静态构建，并核对生成页面中的站内链接与媒体文件。

## 授权

网站程序代码使用 [MIT License](./LICENSE)。除非文件中另有说明，网站文字、绘画、照片、角色设定与其他内容不包含在 MIT 授权范围内，版权归 RonHWung 或相应权利人所有，未经许可不得转载或再利用。
