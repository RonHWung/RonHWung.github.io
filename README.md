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

Windows 下直接双击根目录的 [`preview-local.cmd`](./preview-local.cmd)，然后按键选择：

- `1`：新版微缩地图，`http://127.0.0.1:4321/`
- `2`：旧版资料终端，`http://127.0.0.1:4322/`
- `3`：同时打开新旧两版
- `Q`：停止本窗口启动的预览服务

菜单在服务运行时继续有效，可随时按键打开另一版。自动化检查可用 `preview-local.cmd --both --no-open`。

旧版来源是归档标签 `terminal-v1` 对应的固定提交 `2dd03eb`，静态快照保存在仓库外层的 `workbench-private/atlas-preview/terminal-v1/site/`，不会切换本地分支。快照缺失时，预览脚本会从该提交导出源文件并构建。本地和远端的正式分支均为 `main`；旧版以标签归档。

## 探索界面

首页默认展示干净的微缩地图，采用从正俯视偏转 58° 的总览视角，不自动打开预览。Home 和键盘 Home 恢复同一构图。根据窗口尺寸和实际标签大小调整总览尺度及标注位置，使七个互动入口都可见；标注带清晰边框和细引线，避开标题、控制栏及相互遮挡。地图与上下导航铺满屏幕宽度，页脚保持紧凑，字体和配色沿用 `terminal-v1`，其他页面保持旧版。

右侧为视角滑条、Home、目录，移除重复的加减按钮。滑条连续控制 0–60°，滚轮和捏合使用同一套角度与尺度控制，尺度全程变化仍为 18%。地图方向固定，只改变俯仰。拖动或方向键平移，边缘允许约 9% 视口的余量。目录按钮恢复总览视角，保留地图原有色相，以暖白和浅薄荷色提亮淡化景观，放大七个跳转标注；标注采用奶白底、深色边框与青色侧边，标题和底部英文入口保持清晰。目录模式不播放建筑动效，Home 返回正常地图。

悬停建筑实体、标签或底部 00–06 英文入口展开预览，点击直接进入对应页面。预览约占桌面屏幕三分之一，在鼠标对侧展开，同一次预览保持位置；底部始终留出七个入口的空间，方便连续切换。欢迎插画按完整原图比例排布，内容过长时滚动阅读。关闭按钮或 Esc 收起；不支持 WebGL 时显示亮色淡化的地图插图及原生目的地链接。

各实体仅在当前选中时出现局部活动：信号塔接收波圈、工作台轨道走线、画室绘图轨迹、展馆身份光点、档案馆时钟扫描、营地微光和种植行光点。其他区域保持静止，信号塔西侧桥不高亮。退出悬停并关闭预览后停止绘制动效；减少动态效果偏好保留静态高亮。

北侧三片种植畦及其步道为欢迎互动区。田地入口、HELLO RONHWUNG 和预览中的 HELLO 标题进入 `/welcome/`，完整保留旧版首页；MEET RONHWUNG 与中央展馆进入 `/character/` 角色档案。其余英文入口为 DRAW IT · MAKE IT、ALONG THE WAY、SELECTED WORKS、MONTH BY MONTH 和 REMOTE SIGNAL。

时间线和事件详情恢复旧版，包括横向月份浏览、原始图片排版和摄影署名。

运行 `pnpm test:ui` 可验证地图交互与旧版页面恢复，需先启动本地双版本预览并安装 Playwright Chromium。`pnpm review:visual` 将桌面与手机截图保存到仓库外层的私有审阅目录。`node scripts/review-map.mjs` 生成 0°、30°、60° 截图并与旧版栏目对照。

## 地图资产

[`art/build_atlas.py`](./art/build_atlas.py) 是可复现 Blender 建模源；[`art/atlas-contract.json`](./art/atlas-contract.json) 记录模型要求。地图生成文件为 `public/models/ronghuang-atlas.glb`，采用 Draco 压缩。源 `.blend` 与检查结果保存在仓库外层 `workbench-private/atlas-art/`。

```powershell
& 'D:\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python art\build_atlas.py
& 'D:\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python art\review_atlas.py
& 'D:\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python art\bake_atlas_shadow.py
```

第二条命令在全新进程中导入 GLB 并生成整体、正交及六个区域的近景检查图；第三条生成软件渲染路径使用的阴影烘焙图。加载插图和阴影 WebP 转换命令见 `art/final_report.md`。Three.js 与 Draco 的许可保存在 `public/licenses/`。

## 内容维护

- `src/content/artworks/`：绘画作品
- `src/content/moments/`：活动与生活片段
- `src/data/friends.ts`：友链站名、头像、签名与跳转地址
- `public/media/`：经过网页优化并清除元数据的公开图片

内容通过 Astro Content Collections 校验。调整同一个月内的时间线顺序时，修改条目的 `order` 数字即可。字段说明与新增示例见 [CONTENT_GUIDE.md](./CONTENT_GUIDE.md)。

欢迎朋友们通过 [Pull Request](https://github.com/RonHWung/RonHWung.github.io/pulls) 或 [Issue](https://github.com/RonHWung/RonHWung.github.io/issues) 补充、更新友链资料。

发布前可运行 `pnpm validate`，它会执行类型检查、静态构建，并核对生成页面中的站内链接与媒体文件。

阶段记录、技术决策与后续交接事项按日期保存在 [`development-log/`](./development-log/2026-08-14-initial-site.md)；其中只记录可以公开的信息。

## 发布

推送到 `main` 不会自动发布网站。最终确认内容后，在仓库 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**，再到 Actions 手动运行 **Deploy to GitHub Pages** 工作流。

## 授权

网站程序代码使用 [MIT License](./LICENSE)。除非文件中另有说明，网站文字、绘画、照片、角色设定与其他内容不包含在 MIT 授权范围内，版权归 RonHWung 或相应权利人所有，未经许可不得转载或再利用。
