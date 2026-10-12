# 芯片实例数据契约（V0.1）

每个芯片采用独立数据配置，不将模块布局硬编码在场景代码里。

`public/chips/demo/`：

- `chip.config.json`：ID、名称、机身宽深厚度、外壳外观、顶部文字/贴图路径、整体默认状态。
- `layout.json`：模块 ID、label、type、中心坐标 x/z、width/depth、thickness、玻璃强调色、description、children（可选）。
- `annotations.json`：模块讲解标题、简述、热点链接及说明。
- `materials.json`：玻璃透明度、反射/金属/粗糙度、背景和环境照明预设。
- `cameraPresets.json`：总览与各模块特写的位置 / 目标 / 视场（镜头可覆盖）。
- `presentation.json`：步骤顺序、焦点模块、外壳抬升、爆炸程度、解说文本（后续升级为连续时间轴）。

## 坐标约定
- Three.js：X 左右，Y 竖直，Z 前后；基板中心 X=0 Z=0；芯片顶面朝 +Y。
- `layout.json` 的 x/z 是**世界坐标中的模块中心**，width 沿 X、depth 沿 Z，单位为可视化相对单位。
- 芯片示意版图与外壳可共享参考尺寸，但玻璃厚度、离缝、爆炸方向是**视觉参数**，不能误认为真实晶圆尺寸。
- 模块 ID 不随显示名称变化，以便热点、镜头和讲解步骤稳定关联。

## 参考图输入
图像本身通常不足以恢复精确工艺制程、封装剖面、真实物理 die floorplan。AI 应生成可审核的映射/估计，并保留原始参考与校对信息。视觉纹理可程序化生成，但应称为“示意微结构”。

## 目标架构
`ChipData`（内容）→ `ChipScene`（几何、材质、交互）→ `Presentation`（动画与摄影机状态）→ `UI`（创作者控制）；未来的自动识别是写入 ChipData 的独立输入管线，不与 3D 核心耦合。
