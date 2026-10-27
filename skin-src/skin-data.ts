import { PRODUCT_SAMPLE_IMAGE } from "./product-assets";

export type CatalogCategory =
  | "精华"
  | "乳霜"
  | "清洁"
  | "防晒"
  | "面膜"
  | "眼部"
  | "彩妆"
  | "香水";

export type CatalogProduct = {
  id: string;
  category: CatalogCategory;
  brand: string;
  name: string;
  subtitle: string;
  concern: string;
  reason: string;
  usage: string;
  ingredients: string;
  concerns: string[];
  size: string;
  price: number;
  image: string;
  badge: string;
  step: string;
};

type ProductSeed = Omit<CatalogProduct, "id" | "badge" | "concern" | "reason" | "usage">;

const skinProductSeeds: Record<Exclude<CatalogCategory, "彩妆" | "香水">, ProductSeed[]> = {
  精华: [
    { category: "精华", brand: "曜研", name: "神经酰胺屏障精华", subtitle: "轻盈补脂，安抚干燥紧绷", ingredients: "神经酰胺 + 角鲨烷", concerns: ["屏障波动", "干燥紧绷"], size: "15ml", price: 79, image: PRODUCT_SAMPLE_IMAGE, step: "精华第 1 步" },
    { category: "精华", brand: "澄序", name: "低浓度烟酰胺精华", subtitle: "循序提亮，改善暗沉观感", ingredients: "烟酰胺 + 泛醇", concerns: ["肤色不均", "暗沉"], size: "15ml", price: 89, image: PRODUCT_SAMPLE_IMAGE, step: "精华第 2 步" },
    { category: "精华", brand: "序光", name: "多肽弹润精华", subtitle: "补水充盈，淡化干纹观感", ingredients: "多肽 + 玻尿酸", concerns: ["细纹", "松弛感"], size: "15ml", price: 99, image: PRODUCT_SAMPLE_IMAGE, step: "夜间进阶" },
    { category: "精华", brand: "净界", name: "温和净肤精华", subtitle: "疏通角质，维持清爽细腻", ingredients: "PHA + 锌 PCA", concerns: ["黑头", "毛孔可见"], size: "15ml", price: 85, image: PRODUCT_SAMPLE_IMAGE, step: "每周 2–3 次" },
    { category: "精华", brand: "蓝屿", name: "积雪草舒缓精华", subtitle: "缓解脆弱期的泛红不适", ingredients: "积雪草 + β-葡聚糖", concerns: ["泛红", "轻敏"], size: "20ml", price: 109, image: PRODUCT_SAMPLE_IMAGE, step: "敏感期优先" },
    { category: "精华", brand: "微澜", name: "双分子玻尿酸精华", subtitle: "分层补水，提升水润光泽", ingredients: "玻尿酸 + 海藻糖", concerns: ["缺水", "干纹"], size: "20ml", price: 69, image: PRODUCT_SAMPLE_IMAGE, step: "早晚均可" },
    { category: "精华", brand: "曦研", name: "VC 衍生物焕亮精华", subtitle: "抗氧提亮，改善倦容暗沉", ingredients: "VC 衍生物 + 维 E", concerns: ["暗沉", "肤色不均"], size: "15ml", price: 119, image: PRODUCT_SAMPLE_IMAGE, step: "日间抗氧" },
    { category: "精华", brand: "衡息", name: "油水平衡精华", subtitle: "清爽补水，减少油腻负担", ingredients: "烟酰胺 + PCA 钠", concerns: ["T 区偏油", "缺水"], size: "20ml", price: 92, image: PRODUCT_SAMPLE_IMAGE, step: "分区护理" },
  ],
  乳霜: [
    { category: "乳霜", brand: "曜研", name: "神经酰胺修护面霜", subtitle: "柔润锁水，筑稳肌肤屏障", ingredients: "神经酰胺 + 胆固醇", concerns: ["屏障波动", "泛红"], size: "15g", price: 59, image: PRODUCT_SAMPLE_IMAGE, step: "晚间锁水" },
    { category: "乳霜", brand: "微澜", name: "云感水凝乳", subtitle: "轻盈水润，不易黏腻闷肤", ingredients: "玻尿酸 + 泛醇", concerns: ["混合偏干", "缺水"], size: "30ml", price: 75, image: PRODUCT_SAMPLE_IMAGE, step: "日间保湿" },
    { category: "乳霜", brand: "序光", name: "胜肽充盈晚霜", subtitle: "夜间滋养，提升饱满观感", ingredients: "多肽 + 乳木果脂", concerns: ["细纹", "弹性不足"], size: "20g", price: 129, image: PRODUCT_SAMPLE_IMAGE, step: "夜间进阶" },
    { category: "乳霜", brand: "蓝屿", name: "积雪草安心乳", subtitle: "脆弱期精简护理，舒缓润护", ingredients: "积雪草 + 红没药醇", concerns: ["泛红", "敏感期"], size: "30ml", price: 88, image: PRODUCT_SAMPLE_IMAGE, step: "修护收尾" },
    { category: "乳霜", brand: "澄序", name: "轻盈焕亮凝霜", subtitle: "清爽锁水，维持均匀通透", ingredients: "烟酰胺 + 角鲨烷", concerns: ["暗沉", "肤色不均"], size: "20g", price: 98, image: PRODUCT_SAMPLE_IMAGE, step: "早晚收尾" },
    { category: "乳霜", brand: "净界", name: "净澈控油乳", subtitle: "分区保湿，平衡 T 区油光", ingredients: "锌 PCA + 海藻糖", concerns: ["T 区偏油", "毛孔可见"], size: "30ml", price: 82, image: PRODUCT_SAMPLE_IMAGE, step: "T 区薄涂" },
    { category: "乳霜", brand: "柔光", name: "角鲨烷润养霜", subtitle: "柔润包裹，减少起皮卡粉", ingredients: "角鲨烷 + 燕麦脂", concerns: ["干燥", "卡粉"], size: "20g", price: 105, image: PRODUCT_SAMPLE_IMAGE, step: "局部叠加" },
    { category: "乳霜", brand: "衡息", name: "益生元平衡乳", subtitle: "轻柔维稳，保持舒适肤感", ingredients: "益生元 + 泛醇", concerns: ["肤况波动", "轻敏"], size: "30ml", price: 96, image: PRODUCT_SAMPLE_IMAGE, step: "日常维稳" },
  ],
  清洁: [
    { category: "清洁", brand: "澄序", name: "氨基酸净澈洁面", subtitle: "柔和带走污垢，不拔干", ingredients: "氨基酸表活 + 泛醇", concerns: ["干燥紧绷", "轻敏"], size: "50g", price: 49, image: PRODUCT_SAMPLE_IMAGE, step: "晨晚清洁" },
    { category: "清洁", brand: "净界", name: "毛孔净透洁面凝胶", subtitle: "清爽洁净，重点照顾 T 区", ingredients: "甜菜碱 + 锌 PCA", concerns: ["T 区偏油", "黑头"], size: "60g", price: 55, image: PRODUCT_SAMPLE_IMAGE, step: "晚间清洁" },
    { category: "清洁", brand: "蓝屿", name: "积雪草舒缓洁面乳", subtitle: "低泡温和，脆弱期也舒适", ingredients: "积雪草 + 椰油酰基氨基酸", concerns: ["泛红", "敏感期"], size: "50g", price: 62, image: PRODUCT_SAMPLE_IMAGE, step: "精简护理" },
    { category: "清洁", brand: "微澜", name: "保湿洁颜啫喱", subtitle: "洁后柔软，保留水润感", ingredients: "甜菜碱 + 海藻糖", concerns: ["缺水", "混合偏干"], size: "60g", price: 58, image: PRODUCT_SAMPLE_IMAGE, step: "晨间优先" },
    { category: "清洁", brand: "衡息", name: "双区平衡洁面", subtitle: "清洁与保湿兼顾，肤感轻盈", ingredients: "氨基酸表活 + PCA 钠", concerns: ["外油内干", "毛孔可见"], size: "60g", price: 59, image: PRODUCT_SAMPLE_IMAGE, step: "分区清洁" },
    { category: "清洁", brand: "柔光", name: "柔润卸妆凝乳", subtitle: "轻松卸除日常防晒与淡妆", ingredients: "植物油脂 + 红没药醇", concerns: ["残妆", "干燥"], size: "80ml", price: 72, image: PRODUCT_SAMPLE_IMAGE, step: "晚间第 1 步" },
    { category: "清洁", brand: "曦研", name: "净透卸妆水", subtitle: "清爽卸除彩妆，减少摩擦", ingredients: "胶束科技 + 泛醇", concerns: ["残妆", "油光"], size: "100ml", price: 65, image: PRODUCT_SAMPLE_IMAGE, step: "湿敷卸妆" },
    { category: "清洁", brand: "序光", name: "酵素净颜粉", subtitle: "周期清洁，改善粗糙观感", ingredients: "木瓜酵素 + 米粉", concerns: ["粗糙", "黑头"], size: "12粒", price: 68, image: PRODUCT_SAMPLE_IMAGE, step: "每周 1 次" },
  ],
  防晒: [
    { category: "防晒", brand: "曦研", name: "清透防晒乳 SPF50+", subtitle: "轻薄成膜，通勤防护不黏腻", ingredients: "多重防晒剂 + 维 E", concerns: ["光损伤", "暗沉"], size: "30ml", price: 89, image: PRODUCT_SAMPLE_IMAGE, step: "日间最后一步" },
    { category: "防晒", brand: "蓝屿", name: "敏肌舒适防晒霜", subtitle: "温和防护，减少肌肤负担", ingredients: "氧化锌 + 泛醇", concerns: ["轻敏", "泛红"], size: "30g", price: 99, image: PRODUCT_SAMPLE_IMAGE, step: "日间防护" },
    { category: "防晒", brand: "微澜", name: "水感防晒精华", subtitle: "水润贴肤，适合干燥肤感", ingredients: "复合防晒剂 + 玻尿酸", concerns: ["缺水", "卡粉"], size: "30ml", price: 92, image: PRODUCT_SAMPLE_IMAGE, step: "妆前防护" },
    { category: "防晒", brand: "净界", name: "控油持妆防晒乳", subtitle: "轻盈哑光，减少 T 区油光", ingredients: "复合防晒剂 + 硅石", concerns: ["T 区偏油", "脱妆"], size: "30ml", price: 95, image: PRODUCT_SAMPLE_IMAGE, step: "油区薄涂" },
    { category: "防晒", brand: "柔光", name: "柔焦润色防晒", subtitle: "均匀肤色，打造自然柔光", ingredients: "物化结合防晒 + 色粉", concerns: ["肤色不均", "暗沉"], size: "30g", price: 108, image: PRODUCT_SAMPLE_IMAGE, step: "底妆前" },
    { category: "防晒", brand: "衡息", name: "城市防护隔离乳", subtitle: "清透隔离，日常通勤更省心", ingredients: "复合防晒剂 + 依克多因", concerns: ["通勤防护", "干燥"], size: "30ml", price: 105, image: PRODUCT_SAMPLE_IMAGE, step: "日间防护" },
    { category: "防晒", brand: "澄序", name: "焕亮防晒乳", subtitle: "防晒与提亮兼顾，肤感清爽", ingredients: "复合防晒剂 + 烟酰胺", concerns: ["暗沉", "肤色不均"], size: "30ml", price: 109, image: PRODUCT_SAMPLE_IMAGE, step: "每日足量" },
    { category: "防晒", brand: "序光", name: "户外耐水防晒", subtitle: "稳定防护，适合长时间户外", ingredients: "复合防晒剂 + 维 E", concerns: ["户外暴晒", "光老化"], size: "40ml", price: 119, image: PRODUCT_SAMPLE_IMAGE, step: "及时补涂" },
  ],
  面膜: [
    { category: "面膜", brand: "蓝屿", name: "积雪草急救面膜", subtitle: "短时补水，舒缓脆弱期肤感", ingredients: "积雪草 + 泛醇", concerns: ["泛红", "紧绷"], size: "5片", price: 69, image: PRODUCT_SAMPLE_IMAGE, step: "每周 1–2 次" },
    { category: "面膜", brand: "微澜", name: "深水补水面膜", subtitle: "密集补水，恢复柔软透亮", ingredients: "玻尿酸 + 海藻糖", concerns: ["缺水", "干纹"], size: "5片", price: 59, image: PRODUCT_SAMPLE_IMAGE, step: "夜间 10 分钟" },
    { category: "面膜", brand: "净界", name: "清洁泥膜", subtitle: "分区净化，减少鼻翼油腻感", ingredients: "高岭土 + 锌 PCA", concerns: ["黑头", "T 区偏油"], size: "30g", price: 62, image: PRODUCT_SAMPLE_IMAGE, step: "仅 T 区使用" },
    { category: "面膜", brand: "澄序", name: "焕亮凝胶面膜", subtitle: "水润提亮，改善倦容观感", ingredients: "烟酰胺 + 甘草酸二钾", concerns: ["暗沉", "肤色不均"], size: "5片", price: 75, image: PRODUCT_SAMPLE_IMAGE, step: "重要场合前" },
    { category: "面膜", brand: "柔光", name: "柔润睡眠面膜", subtitle: "整夜锁水，晨起更显饱满", ingredients: "角鲨烷 + 燕麦", concerns: ["干燥", "起皮"], size: "30g", price: 79, image: PRODUCT_SAMPLE_IMAGE, step: "晚霜后薄涂" },
    { category: "面膜", brand: "序光", name: "胜肽弹润面膜", subtitle: "密集润养，改善疲惫纹理", ingredients: "多肽 + 玻尿酸", concerns: ["细纹", "松弛感"], size: "5片", price: 89, image: PRODUCT_SAMPLE_IMAGE, step: "每周 1 次" },
    { category: "面膜", brand: "衡息", name: "益生元平衡面膜", subtitle: "舒适维稳，照顾换季波动", ingredients: "益生元 + β-葡聚糖", concerns: ["肤况波动", "轻敏"], size: "5片", price: 82, image: PRODUCT_SAMPLE_IMAGE, step: "换季护理" },
    { category: "面膜", brand: "曦研", name: "VC 抗氧面膜", subtitle: "焕亮倦容，提升通透观感", ingredients: "VC 衍生物 + 维 E", concerns: ["暗沉", "光损伤"], size: "5片", price: 85, image: PRODUCT_SAMPLE_IMAGE, step: "夜间使用" },
  ],
  眼部: [
    { category: "眼部", brand: "醒眸", name: "咖啡因焕活眼精华", subtitle: "轻盈醒眸，缓解倦态浮肿感", ingredients: "咖啡因 + 七叶树", concerns: ["眼袋", "浮肿"], size: "10ml", price: 69, image: PRODUCT_SAMPLE_IMAGE, step: "早晚轻点" },
    { category: "眼部", brand: "序光", name: "多肽淡纹眼霜", subtitle: "润泽眼周，改善干纹观感", ingredients: "多肽 + 角鲨烷", concerns: ["细纹", "干燥"], size: "10g", price: 89, image: PRODUCT_SAMPLE_IMAGE, step: "晚间使用" },
    { category: "眼部", brand: "微澜", name: "玻尿酸水润眼凝露", subtitle: "清透补水，妆前不易搓泥", ingredients: "玻尿酸 + 海藻糖", concerns: ["眼下缺水", "卡纹"], size: "10ml", price: 65, image: PRODUCT_SAMPLE_IMAGE, step: "妆前轻点" },
    { category: "眼部", brand: "澄序", name: "烟酰胺亮眼精华", subtitle: "改善暗沉观感，提升清透度", ingredients: "烟酰胺 + 咖啡因", concerns: ["眼周暗沉", "倦态"], size: "10ml", price: 79, image: PRODUCT_SAMPLE_IMAGE, step: "早晚使用" },
    { category: "眼部", brand: "蓝屿", name: "舒缓修护眼霜", subtitle: "温和润护，照顾脆弱眼周", ingredients: "泛醇 + 红没药醇", concerns: ["干痒", "轻敏"], size: "10g", price: 82, image: PRODUCT_SAMPLE_IMAGE, step: "精简护理" },
    { category: "眼部", brand: "柔光", name: "柔焦眼部打底霜", subtitle: "平滑干纹观感，提升妆容服帖", ingredients: "角鲨烷 + 柔焦粉体", concerns: ["卡纹", "干燥"], size: "8g", price: 72, image: PRODUCT_SAMPLE_IMAGE, step: "妆前薄涂" },
    { category: "眼部", brand: "衡息", name: "滚珠醒眸精华", subtitle: "清凉按摩，快速舒缓疲态", ingredients: "咖啡因 + 薄荷醇衍生物", concerns: ["浮肿", "疲态"], size: "8ml", price: 59, image: PRODUCT_SAMPLE_IMAGE, step: "随时补用" },
    { category: "眼部", brand: "曜研", name: "神经酰胺眼周乳", subtitle: "补脂锁水，减少干燥拉扯感", ingredients: "神经酰胺 + 维 E", concerns: ["屏障薄弱", "干纹"], size: "10ml", price: 85, image: PRODUCT_SAMPLE_IMAGE, step: "夜间收尾" },
  ],
};

const accentProducts: ProductSeed[] = [
  { category: "彩妆", brand: "映色", name: "暖调柔雾口红 · 琥珀茶", subtitle: "轻暖棕红，呼应暖黄底调", ingredients: "柔润蜡基 + 维 E", concerns: ["暖黄调", "日常通勤"], size: "1.5g 小样", price: 39, image: PRODUCT_SAMPLE_IMAGE, step: "妆容点睛" },
  { category: "彩妆", brand: "映色", name: "柔光气垫 · 暖黄二白", subtitle: "轻盈均匀肤色，呈现自然微光", ingredients: "润色粉体 + 玻尿酸", concerns: ["黄二白", "肤色不均"], size: "5g 体验装", price: 69, image: PRODUCT_SAMPLE_IMAGE, step: "底妆" },
  { category: "彩妆", brand: "映色", name: "细闪高光 · 月砂金", subtitle: "细腻微闪，放大肌肤通透感", ingredients: "珠光粉体 + 植物油脂", concerns: ["自然光泽", "暖调妆容"], size: "2g 小样", price: 45, image: PRODUCT_SAMPLE_IMAGE, step: "局部提亮" },
  { category: "香水", brand: "雾屿", name: "白茶与鸢尾淡香精", subtitle: "干净柔和，贴肤不张扬", ingredients: "白茶 · 鸢尾 · 白麝香", concerns: ["清透木质", "通勤"], size: "2ml 小样", price: 29, image: PRODUCT_SAMPLE_IMAGE, step: "腕间试香" },
  { category: "香水", brand: "雾屿", name: "橙花晨雾淡香水", subtitle: "明亮柑橘，柔和花香收尾", ingredients: "橙花 · 佛手柑 · 雪松", concerns: ["清新花香", "日间"], size: "2ml 小样", price: 29, image: PRODUCT_SAMPLE_IMAGE, step: "颈侧试香" },
  { category: "香水", brand: "雾屿", name: "琥珀晚风淡香精", subtitle: "温暖包裹，留下一点木质余韵", ingredients: "琥珀 · 香草 · 檀木", concerns: ["暖甜木质", "夜晚"], size: "2ml 小样", price: 35, image: PRODUCT_SAMPLE_IMAGE, step: "腕间试香" },
];

const flattenSeeds = [...Object.values(skinProductSeeds).flat(), ...accentProducts];

const displayNames: Record<number, string> = {
  3:"多肽水润弹力精华",4:"温和净肤细致精华",5:"积雪草舒缓保湿精华",8:"油水平衡保湿精华",10:"云感轻盈保湿水凝乳",11:"胜肽夜间充盈晚霜",12:"积雪草舒缓保湿乳",13:"轻盈水润焕亮凝霜",14:"净澈清爽控油乳液",15:"角鲨烷柔润滋养霜",16:"益生元舒适平衡乳",17:"氨基酸净澈洁面乳",20:"水润保湿洁颜啫喱",21:"双区水润平衡洁面",22:"柔润温和卸妆凝乳",23:"轻柔清爽净透卸妆水",24:"木瓜酵素柔润净颜粉",26:"敏肌舒适润护防晒霜",27:"水感保湿防晒精华",28:"控油清爽持妆防晒乳",29:"柔焦自然润色防晒乳",30:"城市通勤防护隔离乳",31:"水润焕亮清透防晒乳",32:"户外耐水清透防晒乳",33:"积雪草舒缓补水面膜",34:"深水柔润保湿面膜",35:"净澈分区清洁泥膜",36:"水润焕亮凝胶面膜",37:"柔润锁水睡眠面膜",38:"胜肽保湿弹润面膜",39:"益生元水润平衡面膜",40:"VC焕亮保湿面膜",42:"多肽柔润淡纹眼霜",44:"烟酰胺焕亮眼部精华",45:"舒缓保湿修护眼霜",46:"柔焦水润眼部打底霜",47:"清润滚珠醒眸精华",48:"神经酰胺保湿眼周乳",51:"细闪柔光高光·月砂金",53:"橙花晨雾清新淡香水",54:"琥珀晚风木质淡香精",
};
const usageByCategory: Record<CatalogCategory, string> = {
  精华:"洁面后取适量均匀涂于面部，轻按至吸收，再搭配乳霜；初次使用可降低频率，按肌肤感受逐步调整。",
  乳霜:"在精华之后取适量均匀涂抹面部与颈部，轻柔按压帮助贴合；干燥区域可少量叠加，按季节调整用量。",
  清洁:"先以温水湿润面部，取适量轻柔打圈清洁，照顾鼻翼等易出油区域；充分冲洗后，及时进行保湿护理。",
  防晒:"日间护肤后按包装指引足量涂抹面部与颈部，覆盖耳部等暴露位置；户外活动、出汗或擦拭后及时补涂。",
  面膜:"洁面后展开面膜并轻轻贴合面部，按包装建议的时长使用；取下后轻按剩余精华，再搭配乳霜锁水。",
  眼部:"洁面护肤后取少量点于眼周，以指腹轻轻按压至吸收，避开睫毛根部与眼睛；妆前使用时待贴合后再上妆。",
  彩妆:"完成基础护肤后，取少量分次上妆，用指腹或合适工具轻拍晕开；根据妆容需求逐步叠加，晚间及时卸妆。",
  香水:"与肌肤保持适当距离，少量喷于手腕或颈侧，待香气自然展开；无需来回揉搓，可依场景与个人喜好调整用量。",
};
const usageOverrides: Record<number,string> = {
  22:"取适量均匀涂于面部，按包装指引轻柔按摩溶解彩妆后清洗，避免用力拉扯肌肤；眼唇区域请按包装说明使用。",
  23:"取适量浸润化妆棉，轻敷后顺肌肤纹理擦拭，避免反复用力摩擦；卸妆后按包装指引清洗，并及时保湿。",
  24:"取少量粉末于掌心，加适量水揉出泡沫后轻柔清洁面部，避开眼周；充分冲洗后保湿，使用频率以包装为准。",
  35:"洁面后在易出油区域薄涂，避开眼周与干燥破损处，按包装建议时长停留后洗净；随后及时进行保湿护理。",
  37:"晚间完成基础护肤后，取适量均匀薄涂面部与颈部，待贴合后入睡；次日正常清洁，初次使用请先局部试用。",
  47:"洁面护肤后，以滚珠沿眼周轻柔滑动，避开睫毛根部与眼睛，再用指腹轻按至吸收；使用后擦净滚珠并盖好。",
  49:"先做好唇部保湿，取少量从唇部中央向外轻轻涂开，可用指腹柔化边缘；按妆效需要叠加，晚间认真卸妆。",
};
const countCopy = (text: string) => Array.from(text.replace(/[\s\p{P}\p{S}]/gu,"")).length;
export const catalogProducts: CatalogProduct[] = flattenSeeds.map((item, index) => {
  const ingredients = index === 22 ? "泛醇" : item.ingredients.split(/\+|·/)[0].trim();
  const baseConcern = item.concerns.join(" · ");
  const concern = countCopy(baseConcern) < 6 ? `${item.category === "眼部" ? "眼周" : "肌肤"}${baseConcern}` : baseConcern;
  const benefitOverrides: Record<number,string> = {4:"温和清洁多余角质，维持肌肤清爽细腻。",13:"清爽保湿锁水，帮助肌肤更显均匀通透。",16:"轻柔保湿维稳，帮助肌肤保持柔润舒适。",49:"轻暖棕红呼应暖黄底调，呈现柔润唇妆。"};
  const subtitle = benefitOverrides[index+1] ?? (item.category === "香水" ? "层次香气柔和展开，为日常造型增添个性。" : countCopy(item.subtitle) < 12 ? `${item.subtitle}，维持舒适肤感。` : item.subtitle);
  return {
    ...item, name: displayNames[index+1] ?? item.name, ingredients, concern, subtitle,
    size: /体验装|小样/.test(item.size) ? item.size : `${item.size}体验装`,
    reason: item.category === "香水" ? `以${ingredients}香调营造柔和的层次气息，适合喜欢低调香气的日常通勤场景。` : `围绕${concern}的护理需求，精选${ingredients}配方，适合日常护理时按需搭配。`,
    usage: usageOverrides[index+1] ?? usageByCategory[item.category],
    step: item.category === "防晒" ? "日间足量涂抹" : item.step,
    id: `demo-sku-${String(index + 1).padStart(3, "0")}`,
    badge: index % 11 === 0 ? "编辑精选" : index % 7 === 0 ? "新品体验" : "图灵核验",
  };
});

export const catalogCategories = ["全部", "精华", "乳霜", "清洁", "防晒", "面膜", "眼部", "彩妆", "香水"] as const;
export type CatalogFilter = typeof catalogCategories[number];

export type SkinDetectionRecord = {
  id: string;
  date: string;
  shortDate: string;
  time: string;
  score: number;
  delta: number;
  title: string;
  keywords: string[];
  tone: string;
  toneColor: string;
  oil: string;
  advice: string;
  photo: string;
  metrics: {
    shine: number;
    pores: number;
    barrier: number;
    eye: number;
  };
};

export const detectionHistory: SkinDetectionRecord[] = [
  { id: "report-0914-2136", date: "2026-09-14", shortDate: "09/14", time: "21:36", score: 82, delta: 4, title: "清透平衡肌", keywords: ["T 区偏油", "眼周缺水", "光泽在线"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "鼻部 T 区偏油", advice: "维持温和清洁，双颊优先补水修护；日间足量防晒。", photo: "/skin-oil-face-v2.png", metrics: { shine: 91, pores: 88, barrier: 64, eye: 60 } },
  { id: "report-0914-1420", date: "2026-09-14", shortDate: "09/14", time: "14:20", score: 78, delta: -1, title: "午后轻油肌", keywords: ["鼻部油光", "毛孔清晰", "双颊平衡"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "T 区油光上升", advice: "午后只在 T 区轻按吸油，避免全脸过度清洁。", photo: "/skin-oil-face-v2.png", metrics: { shine: 84, pores: 73, barrier: 70, eye: 66 } },
  { id: "report-0914-0842", date: "2026-09-14", shortDate: "09/14", time: "08:42", score: 79, delta: 3, title: "晨间柔光肌", keywords: ["水润度佳", "轻微泛红", "细纹可见"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "整体平衡", advice: "晨间减少功效叠加，用保湿精华与防晒维持稳定。", photo: "/skin-oil-face-v2.png", metrics: { shine: 88, pores: 82, barrier: 69, eye: 61 } },
  { id: "report-0911-1955", date: "2026-09-11", shortDate: "09/11", time: "19:55", score: 76, delta: 2, title: "修护进行时", keywords: ["屏障波动", "双颊泛红", "眼周疲态"], tone: "中性暖 · 黄二白", toneColor: "#e6d7ab", oil: "鼻部轻油", advice: "连续 7 天使用舒缓修护配方，暂停高频去角质。", photo: "/skin-oil-face-v2.png", metrics: { shine: 78, pores: 79, barrier: 58, eye: 55 } },
  { id: "report-0907-2230", date: "2026-09-07", shortDate: "09/07", time: "22:30", score: 74, delta: -2, title: "晚间疲态肌", keywords: ["眼袋明显", "缺水", "暗沉"], tone: "中性暖 · 黄二白", toneColor: "#e6d7ab", oil: "整体平衡", advice: "优先补水与规律作息，眼周搭配咖啡因精华轻点。", photo: "/skin-oil-face-v2.png", metrics: { shine: 72, pores: 76, barrier: 60, eye: 50 } },
  { id: "report-0903-0910", date: "2026-09-03", shortDate: "09/03", time: "09:10", score: 76, delta: 5, title: "通透回升肌", keywords: ["光泽回升", "毛孔洁净", "轻微干纹"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "T 区平衡", advice: "继续当前清洁频率，加强面霜锁水与每日防晒。", photo: "/skin-oil-face-v2.png", metrics: { shine: 86, pores: 84, barrier: 66, eye: 63 } },
  { id: "report-0828-2044", date: "2026-08-28", shortDate: "08/28", time: "20:44", score: 71, delta: -1, title: "换季敏感肌", keywords: ["泛红", "屏障不稳", "紧绷"], tone: "中性暖 · 中性暖二白", toneColor: "#d7b897", oil: "双颊偏干", advice: "精简为洁面、修护精华、面霜和防晒四步。", photo: "/skin-oil-face-v2.png", metrics: { shine: 70, pores: 74, barrier: 49, eye: 57 } },
  { id: "report-0821-0816", date: "2026-08-21", shortDate: "08/21", time: "08:16", score: 72, delta: 4, title: "晨间平衡肌", keywords: ["状态平稳", "鼻翼油光", "光泽自然"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "鼻部偏油", advice: "分区护理，T 区少量控油，双颊保持温和保湿。", photo: "/skin-oil-face-v2.png", metrics: { shine: 80, pores: 77, barrier: 62, eye: 64 } },
  { id: "report-0814-2312", date: "2026-08-14", shortDate: "08/14", time: "23:12", score: 68, delta: 0, title: "夜间缺水肌", keywords: ["干纹", "眼周疲态", "肤色不均"], tone: "中性暖 · 黄二白", toneColor: "#e6d7ab", oil: "外油内干", advice: "先建立稳定补水节奏，再逐步加入提亮成分。", photo: "/skin-oil-face-v2.png", metrics: { shine: 69, pores: 71, barrier: 55, eye: 48 } },
];

const recommendationRules: Record<string, string[]> = {
  "T 区偏油": ["demo-sku-008", "demo-sku-014"],
  "鼻部油光": ["demo-sku-008"],
  "眼周缺水": ["demo-sku-043"],
  "眼周疲态": ["demo-sku-041"],
  "毛孔清晰": ["demo-sku-004"],
  "屏障波动": ["demo-sku-001", "demo-sku-009"],
  "双颊泛红": ["demo-sku-005", "demo-sku-012"],
  "缺水": ["demo-sku-006", "demo-sku-010"],
  "暗沉": ["demo-sku-007", "demo-sku-002"],
  "细纹可见": ["demo-sku-003", "demo-sku-042"],
};

export type PersonalizedRecommendation = {
  productId: string;
  matchedKeyword: string;
  sourceRecordId: string;
  sourceDate: string;
  sourceTime: string;
};

// 检测记录按新到旧排列：保留首次命中的问题与记录来源，并对跨记录重复商品去重。
export const personalizedRecommendations = detectionHistory.reduce<PersonalizedRecommendation[]>((recommendations, record) => {
  record.keywords.forEach(keyword => {
    (recommendationRules[keyword] ?? []).forEach(productId => {
      if (!recommendations.some(item => item.productId === productId)) {
        recommendations.push({
          productId,
          matchedKeyword: keyword,
          sourceRecordId: record.id,
          sourceDate: record.shortDate,
          sourceTime: record.time,
        });
      }
    });
  });
  return recommendations;
}, []);

export const personalizedProductIds = personalizedRecommendations.map(item => item.productId);
