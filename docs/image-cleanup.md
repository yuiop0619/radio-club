# 图片水印清理

对以下 32 张原始图片使用 ImageGen 局部修补，移除右下角 Qoder AI 生成字样；不裁剪画面。结果保持原始文件名、尺寸与格式，随后重新生成 WebP 和头像 PNG 衍生资源。生成式编辑可能对细节产生轻微重绘，不能保证像素级一致。

统一编辑提示：Remove only the small Qoder AI watermark in the bottom-right corner. Reconstruct the underlying background naturally. Preserve the original composition, framing, characters, facial identity, colors, illustration style and all other meaningful content. Do not crop. Do not add any text or watermark.

每张图片单独作为参考输入。工具输出保存在本机生成图片目录，最终交付素材在 assets/img；本记录不依赖他人机器上的临时路径。

## 原始文件

- assets/img/about2006-ch1.png
- assets/img/about2006-ch2.png
- assets/img/about2006-ch3.png
- assets/img/about2006-ch4.png
- assets/img/about2006-ch5.png
- assets/img/scene-hall.jpg
- assets/img/scene-seated.jpg
- assets/img/bar-interior.jpg
- assets/img/bt-iwao-menu.jpg
- assets/img/bt-lian-menu.jpg
- assets/img/det-push-form.jpg
- assets/img/mirror-hole.jpg
- assets/img/item-water.jpg
- assets/img/item-milk.jpg
- assets/img/item-coffee.jpg
- assets/img/item-fizz.jpg
- assets/img/item-highball.jpg
- assets/img/item-orange.jpg
- assets/img/item-onigiri.jpg
- assets/img/item-ramen.jpg
- assets/img/item-sandwich.jpg
- assets/img/item-steak.jpg
- assets/img/puppet-det.png
- assets/img/puppet-iwao.png
- assets/img/puppet-lian.png
- assets/img/master-freud.png
- assets/img/master-jung.png
- assets/img/master-horney.png
- assets/img/master-perls.png
- assets/img/master-cartwright.png
- assets/img/master-vonfranz.png
- assets/img/master-zhougong.png
