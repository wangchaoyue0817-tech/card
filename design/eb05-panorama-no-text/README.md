# EB05 无字横版海报

- 成品：`eb05-panorama-no-text-1440x480.png`，1440 × 480 px，3:1，矩形满版。
- 与主 Banner 保持一致的深靛蓝紫光效、珐琅徽章、金属卡边、绳索、丝带及少量金色彩屑。
- 构图改为五张卡牌横向展开，草帽徽章居中，两侧增加剑、罗盘、花眼徽章。不是上一张图片的裁剪或去字版。
- 不含文字、数字、按钮、英文标识或水印；卡面是主题视觉插画，并非实际 EB05 商品卡面。
- 使用内置 image_gen；完整提示词见 `generation-prompt.txt`，原图见 `art-source.png`。
- `export-poster.mjs` 仅进行等比尺寸导出，需要 `sharp`；可通过 `BANNER_SHARP_MODULE` 指定模块路径。
- 保留原主 Banner，未替换或部署线上页面。
