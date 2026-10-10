# 茸磺微缩地图：交付与检查

完成阶段：参考与约束、比例布局、主要及次要形体、连接与拓扑修整、材质、近景细节、压缩导出和独立导入检查。

地图包含六种可识别设施及连续道路、水系、植被、园艺和设备细节。运行时既支持完整地图，也支持放大后的建筑查看；所有生成参数保存在 `build_atlas.py`，随机种子为 522。

## 可复现源与输出

- 源脚本：`art/build_atlas.py`
- 建模约束：`art/atlas-contract.json`
- 浏览器模型：`public/models/ronghuang-atlas.glb`
- 源工程：`../workbench-private/atlas-art/ronghuang-atlas.blend`
- 独立导入审阅：`art/review_atlas.py`
- 原始与独立导入指标：`../workbench-private/atlas-art/{authored-metrics,import-metrics}.json`
- 全景、六向与区域近景：`../workbench-private/atlas-art/landscape-evidence/`
- 浏览器实际画面：`../workbench-private/atlas-review/`

约 44 万三角形、107 个按区域和材质合并的网格。压缩模型约 1.5 MB。独立导入检查无无效顶点、退化面或缺失材质。开放的顶棚、河面、道路和合并材质部件符合浏览器景观的用途；不采用用于打印模型的单一水密性要求。

近景修整包含屋顶柱梁、太阳能板支座、工坊台阶与布卷、营地座椅、画廊码头、木栈道和种植畦。模型没有直接使用游戏的地图、建筑或图标素材。

标准资产工具的固定小型物体灯光在此景观尺寸下过暗，其结果留在 `evidence/`。可见质量判断使用额外的景观尺度灯光、每个区域的近景及浏览器实际呈现。

软件 WebGL 使用完整几何、顶点固定光照和 `art/bake_atlas_shadow.py` 的阴影烘焙。地图视角静止时不重复绘制。原始软件 PBR 测量约 3 fps，优化后的软件路径约 9 fps；Intel Iris Xe 的硬件路径实测约 60 fps。软件路径仍受 CPU 光栅化限制，可通过地图右侧的简化索引直接访问栏目。测量记录位于 `../workbench-private/atlas-review/performance-final.json`，不能据此保证所有设备的帧率。

首页整合保留此精修模型，使用固定方位的俯视到 60° 斜视交互。2026-10-10 起默认为 58° 总览，加载插图由实际默认地图生成；启动本地新版预览后运行 `node scripts/review-map-effects.mjs`，同时保存七个实体的局部动画截图、录像与实际绘制帧率。当前本机硬件测量约 60 fps，其他实体不播放活动，静止状态不重复绘制。

在重新生成阴影后更新软件路径插图：

```powershell
node -e "import sharp from 'sharp'; await sharp('../workbench-private/atlas-art/shadow-bake.png').flatten({background:'#ffffff'}).linear(.35,.65*255).webp({quality:95}).toFile('public/models/atlas-shadow.webp');"
```
