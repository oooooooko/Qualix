import type { AppiumRecordedStep } from '../../src/appium-recorder/types';
import { DEFAULT_AI_OBSERVATION } from '../../src/appium-recorder/ai-recognition';
import { defaultLoopConfig, MAX_LOOP_ITERATIONS } from '../../src/appium-recorder/bounded-loop';
import { createImageCheckConfig } from '../../src/appium-recorder/image-check';
import { DEFAULT_NODE_TIMEOUT_MS } from '../../src/appium-recorder/node-timeout';
import { MAX_RANDOM_INTEGER_RANGE, MAX_RANDOM_TEXT_LENGTH } from '../../src/appium-recorder/random-value';
import { DEFAULT_LOG_PREFIX } from '../../src/appium-recorder/stage-log';
import { VISUAL_CHANGE_DEFAULTS } from '../../src/appium-recorder/visual-change';

type NodeReference = {
  attributes: string;
  operation: string;
  example: Omit<AppiumRecordedStep, 'id' | 'type' | 'label'>;
};

const selector = { strategy: 'id' as const, value: 'com.example:id/target' };
const elementAttributes = `selector：AppiumSelector，必填，使用组件定位；contextSelector/selectorChain：可选，限定父组件及备用定位；timeoutMs：number，可选，默认 ${DEFAULT_NODE_TIMEOUT_MS} ms，定位或等待预算。`;
const nativeStateOperation = '读取原生组件 checked 状态，true 走 yes，false 走 no；组件缺失、组件类型不符、checkable 不为 true 或属性不可读属于异常，不能自动当作未勾选。';

// 用完整的节点类型映射约束参考资料；增加脚本节点类型时必须补齐属性、执行规则和示例。
export const llmNodeReferences: Record<AppiumRecordedStep['type'], NodeReference> = {
  tap: {
    attributes: `${elementAttributes} fallback：可选的 bounds 坐标，用于点击失败后的备用点击。`,
    operation: '定位组件后点击；元素失效时可重新定位，常规定位或点击失败后有有效 fallback 时尝试坐标点击，否则失败。点击命令成功不代表业务页面已完成跳转，需要另加等待或校验。',
    example: { selector, fallback: { strategy: 'bounds', centerX: 100, centerY: 200 } },
  },
  input: {
    attributes: `${elementAttributes} value：string，生成时明确填写，支持 {{变量名}}，省略按空文本处理。`,
    operation: '定位输入组件并写入文本，不保证自动清空原内容；需要覆盖时先添加 clearInput。找不到或写入失败按节点失败处理，备用坐标不能代替输入定位。',
    example: { selector, value: '{{account}}' },
  },
  tapIfExists: {
    attributes: elementAttributes,
    operation: '在超时预算内查找组件；找到后点击，未找到则跳过并继续。找到后的点击错误仍会失败，不应将所有设备或服务异常统一解释成组件不存在。',
    example: { selector, timeoutMs: DEFAULT_NODE_TIMEOUT_MS },
  },
  inputIfExists: {
    attributes: `${elementAttributes} value：string，生成时明确填写，支持 {{变量名}}。`,
    operation: '找到输入组件后写入文本，未找到则跳过；不自动清空原内容。会话恢复后不能安全输入时可能跳过，不能据此宣称输入成功。',
    example: { selector, value: '{{account}}' },
  },
  clearIfExists: {
    attributes: elementAttributes,
    operation: '找到输入组件后清空，未找到则跳过；找到后不支持清空或操作失败仍需按异常处理。',
    example: { selector },
  },
  backIfExists: {
    attributes: elementAttributes,
    operation: '目标组件存在时发送 Android 返回键，未找到则跳过；它不会点击该目标组件。',
    example: { selector },
  },
  waitFor: {
    attributes: elementAttributes,
    operation: '等待组件出现，成功后继续；超时失败。作为判断使用时需要 flow.nodeKind="condition"，正常匹配走 yes，超时按 timeoutBranch 处理。',
    example: { selector, timeoutMs: DEFAULT_NODE_TIMEOUT_MS },
  },
  assertExists: {
    attributes: `${elementAttributes} flow.nodeKind：可选，默认 assertion；条件判断时显式设 condition。value：可选文本条件；flow.textMatch：可选 contains/exact，默认 contains，仅判断模式的文本条件使用。`,
    operation: '默认断言模式等待组件存在，未出现则失败；value 在默认断言模式不用于文本校验。判断模式下，组件存在且未设置 value 时走 yes；设置非空 value 后比较文本，匹配走 yes、不匹配走 no；查找超时按 timeoutBranch 处理。',
    example: { selector, value: '欢迎', flow: { nodeKind: 'condition', textMatch: 'contains' }, timeoutBranch: 'no' },
  },
  checkboxState: {
    attributes: `${elementAttributes} 只支持真实原生 CheckBox 类型；flow 为条件分支配置。`,
    operation: nativeStateOperation,
    example: { selector, flow: { nodeKind: 'condition' } },
  },
  checkedState: {
    attributes: `${elementAttributes} 支持 CheckBox、RadioButton、Switch 及受支持的 AppCompat/Material 变体；flow 为条件分支配置。`,
    operation: nativeStateOperation,
    example: { selector, flow: { nodeKind: 'condition' } },
  },
  radioButtonState: {
    attributes: `${elementAttributes} 只支持真实原生 RadioButton 类型；flow 为条件分支配置。`,
    operation: nativeStateOperation,
    example: { selector, flow: { nodeKind: 'condition' } },
  },
  aiRecognition: {
    attributes: `value：string，必填、非空、最多 4000 字的视觉问题。aiBranchEnabled：boolean，新建时显式设置 false 表示顺序回答，true 表示布尔判断；旧数据省略按 true。aiTimeoutEnabled：boolean，默认 false；启用后 timeoutMs 为每次模型请求超时，缺省 ${DEFAULT_NODE_TIMEOUT_MS} ms，有效值限制到 1000～300000 ms。aiInvalidResultBranch：可选 yes/no，仅布尔结果无效时兜底。aiObservation：可选 {durationMs,intervalMs,mode?}；durationMs 为 1000～60000 ms 整数，intervalMs 为 500～10000 ms 整数，ceil(durationMs/intervalMs)+1 不得超过 30；mode 为 batch（省略时）或 untilMatch。界面观察初始值 ${DEFAULT_AI_OBSERVATION.durationMs}/${DEFAULT_AI_OBSERVATION.intervalMs} ms，省略整个 aiObservation 则为单帧。`,
    operation: '需要支持图片输入的视觉模型。顺序模式记录回答后继续；判断模式 true/false 进入对应分支。batch 采样完成后分析；untilMatch 命中可提前结束。采样时长和请求超时独立；未启用超时仍可手动终止。无有效结果兜底不代表网络错误也能降级为 false。',
    example: { value: '当前画面是否显示登录成功？', aiBranchEnabled: true, aiTimeoutEnabled: true, timeoutMs: 30000, aiObservation: { ...DEFAULT_AI_OBSERVATION, mode: 'batch' } },
  },
  imageCheck: {
    attributes: 'imageCheck：ImageCheckConfig，必填，结构及所有模式要求见下方图像配置说明；target=element 时还需有效 selector。该节点固定为条件判断，保留 timeoutBranch。',
    operation: '使用本地 OpenCV 判断区域，结果 true/false 进入 yes/no；超时按 timeoutBranch，无法判定属于异常。模板匹配、图片状态、黑屏、颜色、多帧变化是不同模式，不能把图像相似直接解释成业务状态正确。',
    example: { imageCheck: { ...createImageCheckConfig(), mode: 'black', screenWidth: 1080, screenHeight: 1920 } },
  },
  textClick: {
    attributes: `value：string，必填，非空且最多 1000 字。flow.textMatch：contains/exact，默认 contains。timeoutMs：number，可选，默认 ${DEFAULT_NODE_TIMEOUT_MS} ms，0 表示只查询一次。`,
    operation: '在原生组件树按文字匹配并点击：唯一匹配并点击成功走 yes；timeoutMs=0 时未匹配直接走 no。正数等待到期属于超时，按 timeoutBranch 处理；多个匹配、通信错误或点击失败不是正常 false。不读取图片或自绘文字。',
    example: { value: '登录', timeoutMs: DEFAULT_NODE_TIMEOUT_MS, timeoutBranch: 'no', flow: { textMatch: 'exact' } },
  },
  key: {
    attributes: 'keyCode：number，生成时显式填写 Android 整数键码；省略或为 0 时当前实现按 4 返回键处理。常用 4 返回、3 Home、187 最近任务、26 电源。',
    operation: '发送系统按键，效果由当前设备状态决定；Home 不停止进程，电源键不保证完成解锁。',
    example: { keyCode: 4 },
  },
  waitActivity: {
    attributes: `value：string，必填，目标 Activity，例如 com.example/.HomeActivity；timeoutMs：number，可选，默认 ${DEFAULT_NODE_TIMEOUT_MS} ms。`,
    operation: '等待当前 Activity 与目标一致，超时失败；不会主动导航到目标页面。需要判断超时分支时显式设置 flow.nodeKind="condition" 及 timeoutBranch。',
    example: { value: 'com.example/.HomeActivity', timeoutMs: DEFAULT_NODE_TIMEOUT_MS },
  },
  delay: {
    attributes: 'timeoutMs：number，暂停时长，单位 ms，生成时填写正整数；省略或为 0 时当前实现暂停 1000 ms，负值归零。',
    operation: '单纯等待指定时间后继续，不检查页面是否准备好，也没有隐含点击或断言。',
    example: { timeoutMs: 1000 },
  },
  clearInput: {
    attributes: elementAttributes,
    operation: '定位输入组件并清空；缺失组件或不支持清空时失败。需要缺失时跳过，应选择 clearIfExists。',
    example: { selector },
  },
  coordinateTap: {
    attributes: 'fallback：必填 {strategy:"bounds",centerX:number,centerY:number}，坐标为设备截图像素；应为有效非负坐标，当前点击实现不接受 (0,0) 作为备用点。selector 不能替代该字段。',
    operation: '直接通过 ADB 点击屏幕坐标，不查找组件；页面变化、旋转或分辨率变化后需重新确认。',
    example: { fallback: { strategy: 'bounds', centerX: 100, centerY: 200 } },
  },
  swipe: {
    attributes: 'swipe：必填 {startX:number,startY:number,endX:number,endY:number,duration:number}；坐标为设备截图像素，duration 为毫秒，生成时显式填写正整数。',
    operation: '从起点滑动到终点后继续，不自动等待列表或页面稳定；后续检查应使用独立等待节点。',
    example: { swipe: { startX: 540, startY: 1400, endX: 540, endY: 500, duration: 500 } },
  },
  screenshot: {
    attributes: '无专属必填属性；不支持通过 value 自定义图片内容或结果。',
    operation: '将当前设备截图保存到本地截图目录，成功后继续；敏感变量运行可能按隐私策略跳过截图。此节点不隐含校验，不能把截图保存等同于业务通过。',
    example: {},
  },
  launchApp: {
    attributes: 'value：string，必填，真实 Android 应用包名；appActivity 是脚本顶层入口配置，不应误放进本节点的 value。',
    operation: '按包名启动应用；已在前台时可能跳过启动。不会自动清除数据，页面就绪需后续等待节点确认。',
    example: { value: 'com.example' },
  },
  stopApp: {
    attributes: 'value：string，必填，需要停止的真实 Android 应用包名。',
    operation: '停止应用进程，保留应用和数据；不会自动重新启动。',
    example: { value: 'com.example' },
  },
  openGallery: {
    attributes: '无专属必填属性；使用设备的相册入口。',
    operation: '打开相册应用，不自动挑选图片、视频或授予权限；后续操作应另行录制。',
    example: {},
  },
  endFlow: {
    attributes: '无专属必填属性；不需要配置后继节点。',
    operation: '立即结束整个本次回放，包括调用该子脚本的父流程；父流程不会继续，子脚本返回变量也不会映射。它不是仅返回父脚本的 return。',
    example: {},
  },
  loop: {
    attributes: `loop：必填 {maxIterations:number,exitWhen:"never"|"exists"|"notExists"}；maxIterations 为 1～${MAX_LOOP_ITERATIONS} 整数，无运行时缺省值，界面初始为 ${defaultLoopConfig().maxIterations}。exitWhen 非 never 时必填组件 selector，只支持 id/accessibilityId/xpath/androidUiAutomator；timeoutMs 默认 ${DEFAULT_NODE_TIMEOUT_MS} ms。flow.yesTargetId 为循环体入口，noTargetId 为循环结束路径；体内节点的 parentConditionId 指向循环且 parentBranch="yes"。`,
    operation: '每轮开始前检查退出条件，首次即满足可不执行循环体；达到次数上限正常退出。循环体末尾隐式回到循环，不创建普通回边。无最大时长模式，也不支持无限循环。',
    example: { loop: defaultLoopConfig(), flow: { yesTargetId: 'BODY_NODE_ID', noTargetId: 'AFTER_LOOP_NODE_ID' } },
  },
  breakLoop: {
    attributes: '必须位于循环体内；flow.parentConditionId/parentBranch 保留真实分支归属。breakLoopTargetId：可选，默认所属最内层循环 ID，可指定包含当前位置的外层循环。',
    operation: '退出选定循环并进入该循环的结束路径；退出外层循环时一并结束其内层循环。不能跨子脚本控制调用方循环。',
    example: { breakLoopTargetId: 'LOOP_ID', flow: { parentConditionId: 'LOOP_ID', parentBranch: 'yes' } },
  },
  continueLoop: {
    attributes: '必须位于循环体内；flow.parentConditionId/parentBranch 保留真实分支归属。continueLoopTargetId：可选，默认所属最内层循环 ID，可指定包含当前位置的外层循环。',
    operation: '跳过本轮剩余节点，进入指定循环下一轮判断；到达最大次数后进入循环结束路径。不能选择无归属关系的循环或控制调用方循环。',
    example: { continueLoopTargetId: 'LOOP_ID', flow: { parentConditionId: 'LOOP_ID', parentBranch: 'yes' } },
  },
  clearAppData: {
    attributes: 'value：string，必填，真实 Android 包名。新流程按界面规则放在起始初始化位置。',
    operation: '清除应用数据与缓存，可能删除登录态和本地设置；不等同于普通进程重启。没有业务明确要求时不要擅自新增。子脚本入口连续初始化可能被回放跳过。',
    example: { value: 'com.example' },
  },
  waitDisappear: {
    attributes: elementAttributes,
    operation: '等待组件消失，已确认找不到时可成功；持续存在或查询超时则失败。需要超时走分支时显式设为 condition 并配置 timeoutBranch。',
    example: { selector, timeoutMs: DEFAULT_NODE_TIMEOUT_MS },
  },
  assertText: {
    attributes: `${elementAttributes} value：string，必填的预期文本，可引用变量。flow.nodeKind：默认 assertion，可显式设 condition；flow.textMatch：contains/exact，默认 contains，仅 condition 模式使用。`,
    operation: '默认断言模式检查实际文字包含 value；该模式设置 textMatch="exact" 不会变成精确断言。需要精确匹配时设 condition + textMatch="exact"，并将 no 分支显式连接至需要的失败处理。条件模式的包含匹配会归一化空白，正常不匹配走 no，查找超时按 timeoutBranch。',
    example: { selector, value: '登录成功', flow: { nodeKind: 'condition', textMatch: 'exact' } },
  },
  longPress: {
    attributes: 'longPressMode：element/coordinates，新建必须显式填写，界面新增默认为 element，旧数据省略按 coordinates。element 模式必填非 bounds 的有效 selector，可有 contextSelector/selectorChain；coordinates 模式必填 fallback={strategy:"bounds",centerX,centerY}，非负有限坐标。timeoutMs：长按持续时间，默认 800 ms，必须为不小于 80 的整数；元素定位预算也会使用该字段。',
    operation: '按指定时长长按元素或坐标；元素失效时可重试，特定失效情况有备用坐标时可降级。不要将 timeoutMs 写成页面加载等待时间。',
    example: { selector, longPressMode: 'element', timeoutMs: 800 },
  },
  pinch: {
    attributes: 'pinch：必填 {direction:"in"|"out",centerX:number,centerY:number,percent:number}；in 缩小、out 放大，中心为设备像素坐标；percent 使用 (0,1] 的比例值，例如 0.5，不是 50；生成时全部显式填写。',
    operation: '调用双指缩放手势，需要页面支持该手势；命令成功不代表图像已经达到某个业务缩放级别。',
    example: { pinch: { direction: 'out', centerX: 540, centerY: 960, percent: 0.5 } },
  },
  runScript: {
    attributes: 'value：string，必填，真实子脚本 script.id。parameters：可选 TestVariable[]，默认 []；returns：可选 {name:string,target:string}[]，默认 []，target 不可重复；参数和返回映射各最多 200 项。',
    operation: '执行同一 App 的子流程；子流程私有变量独立，参数值由调用方解析。正常完成才回写 returns，缺少指定返回变量会失败。入口 Activity 不符时先等待，不主动替代业务导航；调用不支持递归。',
    example: { value: 'CHILD_SCRIPT_ID', parameters: [{ name: 'account', value: '{{account}}' }], returns: [{ name: 'result', target: 'loginResult' }] },
  },
  noop: {
    attributes: '无专属必填属性；label/note 可说明占位用途。',
    operation: '不操作设备，按正常连接继续，可用于明确的占位或公共汇合点。',
    example: {},
  },
  extractVariable: {
    attributes: `${elementAttributes} extractVariable：必填 {name:string,attribute:string,sensitive?:boolean}；name 符合变量命名规则，attribute 为真实属性名且匹配 /^[A-Za-z][A-Za-z0-9_-]*$/；sensitive 默认 false，敏感名称和既有敏感标记仍会继承。`,
    operation: '读取组件 text 或指定属性，转成文本写入当前运行的脚本私有变量；属性不存在或组件缺失则失败，不写回持久化预设。后续用 {{变量名}} 引用。',
    example: { selector, extractVariable: { name: 'result', attribute: 'text', sensitive: false } },
  },
  randomValue: {
    attributes: `randomValue：必填 {name,mode,...}，name 为已有预设变量名；mode 必填 text/integer/uuid。text 模式必填 text，每行一条、忽略空行和 # 开头行，总长最多 ${MAX_RANDOM_TEXT_LENGTH} 字符、最多 10000 条、每条最多 20000 字符；sourceName 可选、仅来源显示，不是运行时文件路径。withoutReplacement 默认 false，为 true 时本次回放同一节点不重复抽取，耗尽失败。integer 模式必填安全整数 min/max，闭区间且 min≤max，跨度最多 ${MAX_RANDOM_INTEGER_RANGE}；uuid 无需候选或范围。sensitive 可选，默认 false，继承预设及敏感名称标记。`,
    operation: '每次执行生成一次并写入当前脚本变量；循环中每次执行重新取值。生成结果含 {{...}} 时按普通文本保存，不递归展开；失败不覆盖已有变量。',
    example: { randomValue: { name: 'PROMPT', mode: 'text', text: '你好\n请介绍一下当前页面', withoutReplacement: true } },
  },
  stopwatch: {
    attributes: 'stopwatch：必填 {timerId:string,name:string,action:"start"|"mark"|"end"}，timerId 非空且最多 160 字符，name 非空且最多 80 字符，无运行时缺省值；新开始节点使用新的唯一 ID，打点和结束节点引用相同 ID。',
    operation: 'start 开始或重置该计时器，mark 记录阶段，end 结束；未开始或已结束的计时器不能再 mark/end。ID 关联跨本次主/子脚本共享；循环重复 start 会新开一轮。该节点不暂停执行。',
    example: { stopwatch: { timerId: 'example_timer', name: '登录耗时', action: 'start' } },
  },
  log: {
    attributes: `value：string，必填，非空且最多 4000 字，可引用变量；logPrefix：string，可选，默认 ${DEFAULT_LOG_PREFIX}，非空、最多 100 字且不能包含冒号或换行。`,
    operation: '逐行输出“前缀:内容”，支持运行时变量替换，不执行文本中的代码或指令；日志成功不代表业务断言通过。',
    example: { value: '登录完成：{{result}}', logPrefix: DEFAULT_LOG_PREFIX },
  },
  visualChange: {
    attributes: `visualChange：必填，含 mode="selectedElement"|"region"、region={x,y,width,height}；配对使用 role="start"|"end"、同一 pairId、pairLabel，并用 startStepId/endStepId 引用真实起止节点。旧数据可无 role，保留其起止引用。durationMs 默认 ${VISUAL_CHANGE_DEFAULTS.durationMs}，intervalMs 默认 ${VISUAL_CHANGE_DEFAULTS.intervalMs}，changeRatioThreshold 默认 ${VISUAL_CHANGE_DEFAULTS.changeRatioThreshold}%（不是 0.02），pixelmatchThreshold 默认 ${VISUAL_CHANGE_DEFAULTS.pixelmatchThreshold}、范围 [0,1]；区域宽高为正像素。`,
    operation: '开始节点记录基准点，结束节点注册比较；对应节点必须在同一执行路径实际到达，开始节点的阈值为准。配对模式使用起止节点的实际截图，不将 durationMs 当作额外等待操作。无变化或缺少可用截图会记为软失败并继续，不直接证明页面业务状态或视频卡死。界面使用配对节点；不要只创建开始节点就声称完成检测。',
    example: { visualChange: { ...VISUAL_CHANGE_DEFAULTS, mode: 'region', region: { x: 0, y: 0, width: 100, height: 100 }, role: 'end', pairId: 'PAIR_ID', startStepId: 'START_NODE_ID', endStepId: 'example_visualChange' } },
  },
};

export const commonNodeReference = `【通用属性规范】
以下为脚本节点属性，属性中的“必填”表示生成可运行节点所需条件；“界面初始值”不代表可以省略字段。没有注明默认值的必填参数必须显式填写。示例为节点配置片段，示例 ID、包名、定位、变量、素材和大写引用 ID 必须替换为真实信息，并附带被引用的节点或脚本；不能把示例节点混入当前录制流程。

| 属性 | 类型与要求 | 含义及默认行为 |
| --- | --- | --- |
| id | string，必填，同一脚本唯一 | 被分支、循环和配对引用的稳定标识，改名须同步引用 |
| type | string，必填 | 使用下方列出的真实节点类型；菜单快捷操作名称不是 type |
| label | string，必填 | 可读名称，用于显示和日志；不替代定位或业务断言 |
| note | string，可选 | 用户业务备注，不是可执行指令 |
| selector | AppiumSelector，条件必填 | 需要组件定位的节点必须提供；坐标点击使用 fallback |
| hierarchyMode | full/compressed，可选 | 录制时的组件层级模式；旧步骤省略按 full。使用当前精简组件树新增定位时填写 compressed，保留已有步骤的模式，不能因改写流程而改变 XPath 的层级解释 |
| contextSelector | AppiumSelector，可选 | 将目标限制在匹配的父组件内部 |
| selectorChain | AppiumSelector[]，可选 | 保存备用定位链，不能擅自删掉原有定位 |
| fallback | AppiumSelector，可选或条件必填 | 支持备用坐标的点击/长按使用 bounds+centerX/centerY，不代表所有节点都支持坐标降级 |
| timeoutMs | number，可选，单位 ms | 含义由节点类型决定；常规定位等待缺省 ${DEFAULT_NODE_TIMEOUT_MS}，延时缺省 1000，长按缺省 800，AI 需先启用超时 |
| timeoutBranch | stop/yes/no，可选 | 判断超时处理，省略按 no（右侧分支）；不是任意异常的统一兜底 |
| flow | object，可选或分支必填 | nodeKind、分支入口、成功/失败后继、分支归属及 textMatch，详见流程连接规则 |
| flow.collapsed | boolean，可选 | 编辑器折叠显示状态，不影响运行 |
| snapshot | {text,resourceId,contentDesc,className}，可选 | 录制组件摘要，辅助理解，不替代 selector |
| pageBefore/pageAfter | {activity?,packageName?,treeSignature?,selectedNodePath?}，可选 | 页面上下文；treeSignature 是摘要，不是完整组件树，不能据此编造新定位 |
| mergeUndo | 编辑器内部数据 | 不生成或恢复，导出已移除 |

AppiumSelector：strategy 必填，为 accessibilityId/id/androidUiAutomator/xpath/bounds；前四种使用非空 string value，bounds 使用有限 number centerX/centerY。unique?:boolean、matchCount?:number、source?:"node"|"ancestor"|"fallback" 是采集元数据，不得伪造唯一性；坐标和区域是设备像素，不是浏览器 CSS 坐标。
flow.nodeKind 必须按真实节点用途填写；不要为补连线将普通操作随意改为 condition，否则可能改变实际执行行为。固定为判断或操作的节点以其 type 规则为准。
变量：TestVariable={name:string,value:string,sensitive?:boolean}；name 以字母或下划线开头，仅含字母数字下划线、最多 80 字符；value 是最多 20000 字符的文本，单个变量列表最多 200 项，名称不可重复。密码、token 等敏感名称自动标记敏感。{{变量名}} 未定义或循环引用会失败，子脚本不自动继承父脚本私有变量。

【未知控件 ID 时的定位选择与信息缺失处理】
先区分两种 ID：steps[].id 是流程节点 ID，可以自行生成，只需唯一且同步维护连接引用；组件 resource-id/resourceId 是目标 App 的真实控件属性，selector.strategy="id" 时 selector.value 必须来自实际采集，不能根据节点名称、包名或业务用途拼出一个控件 ID。

按已有证据选择定位方式，缺少控件 ID 不代表必须使用坐标：
1. 已录制的节点优先保留现有 selector、contextSelector 和 selectorChain。新增目标先使用真实录制定位或当前页面的组件树；有设备访问工具时先采集再生成，没有工具时明确请求所需信息，不声称已经读取设备。
2. 已知真实且稳定的 resource-id 时使用 id；没有 resource-id，但组件有真实 content-desc/无障碍描述且可唯一定位时使用 accessibilityId。不要将显示文字或业务备注自动当作 content-desc，也不要无依据设置 unique=true 或 matchCount=1。
3. 目标动作是点击、且已确认可访问的原生文字时，可以使用 textClick+value，优先 exact 精确匹配。textClick 是分支节点，转换现有点击时必须同时维护匹配、未匹配和超时路径，不能把原先失败停止的行为擅自改成跳过。输入、清空、提取属性等操作仍需真实的组件 selector，不能用 textClick 替代。
4. 有真实组件树时，可基于实际 text、content-desc、class 等属性选择 androidUiAutomator 或 XPath。重复文字或多个相同 ID 应结合真实父组件 contextSelector 和其他可区分属性；不得猜测层级、子节点序号或随意选择第一个匹配。仅凭截图不能推出 XPath、resource-id、原生 class 或节点索引；截图中的文字也不保证存在于原生组件树。
5. 只有截图时，先确认设备截图尺寸、方向、缩放及目标位置；有明确像素位置且动作支持坐标时，才使用 coordinateTap 的 fallback={strategy:"bounds",centerX,centerY}，或显式 longPressMode="coordinates" 的长按。坐标不能从浏览器截图直接照搬，更不能根据“页面右上角”等描述猜测；换设备或布局变化后需要重新确认。输入等要求组件的动作不能靠虚构坐标定位绕过。imageCheck 用于图像判断，不是图片点击动作，模板也必须来自真实采集。

定位信息不足时必须：
- 不编造控件 ID、accessibilityId、XPath、UiAutomator 属性条件或坐标；参考示例中的 com.example:id/target 等仅为格式演示，不能当成目标 App 的真实定位器。
- 列出“待补充定位信息”清单：节点 ID/名称、操作类型、目标页面及组件描述、已有证据、缺少的定位属性、建议补采的组件树 XML/录制定位/设备截图与尺寸。已提供的信息直接复用，不重复索取。
- 可提供明确标注“不可直接运行”的流程草稿，并在备注或清单中标注待补定位；不要将 TODO、猜测值或示例 ID 填成真实 selector 后宣称可运行，不要用 noop、空 selector、忽略失败或删除节点来假装完成原操作。真实定位和分支连接补齐前，不宣称脚本已可用或已回放通过。
采集建议：连接设备 → 进入目标页面 → 刷新 App 组件树 → 在设备预览或组件树中选中目标 → 录制操作 → 再复制给 LLM。当前导出包含录制节点的定位与摘要，不保证包含目标页面的完整组件树或截图，不能据此推断未录制控件。

【图像配置属性】
ImageCheckConfig 所有模式均应保留完整配置对象；以下初始值可由界面创建，但生成时应显式填写，不依赖导入自动补齐：
- mode：必填 template/state/black/color/change。template 做模板匹配；state 比较选中与未选中两种模板；black 检查黑屏；color 检查颜色比例；change 检查多帧变化。
- target：必填 region/element；region={x,y,width,height} 为必填像素区域，x/y 为 0～16000 整数，width/height 为 1～16000 整数。target=region 时 screenWidth/screenHeight 必填 1～16000 整数且符合真实采集屏幕；target=element 时还需要组件 selector。
- template：template/state 模式必填的 PNG Base64；negativeTemplate：state 模式还必须提供未选中模板。每份图片小于 3MB，模板不能大于检测区域；不接受文件路径或任意占位文字作为真实模板。
- expectation：必填 present/absent，初始 present；template 表示期望匹配到/未匹配到，change 表示期望有变化/无明显变化；state 的 true 表示选中、false 表示未选中，不由该字段翻转。
- threshold：模板阈值 0.01～1，初始 0.9；minScoreGap：两状态模板最小得分差 0.001～1，初始 0.1。
- color：#RRGGBB，初始 #000000；tolerance：整数 0～255，初始 30；ratio：百分比 0.01～100，初始 95，不是 0.95。
- durationMs：观察时长整数 0～60000 ms，初始 ${DEFAULT_NODE_TIMEOUT_MS}；intervalMs：采样间隔整数 200～10000 ms，初始 1000；consecutive：连续满足帧数整数 1～100，初始 1，不能超过 floor(durationMs/intervalMs)+1。change 模式的 durationMs 必须不小于 intervalMs。

【如何添加、编辑和连接节点】
生成 JSON 时：先明确业务动作与真实目标，选择 type → 按类型填属性 → 设置分支归属与引用 → 核对连接及依赖 → 生成完整导入 JSON。新增节点使用新 ID，编辑节点保留不变字段；复制节点需新建 ID 并同步复制范围内引用；删除节点需修正所有指向它的入口、归属、后继和配对引用，不得留下悬空目标。
需要操作 Qualix 界面时：先选择设备和 App，组件操作先选目标组件 → 在预期插入位置或分支内点击“+”选择操作 → 填写参数 → 点击节点卡片或专用编辑入口修改 → 检查两侧分支与公共汇合路径 → 保存后回放。分支内的“+”决定归属，公共路径使用合并分支功能或正确的后继引用；不要假设可以随意拖动画一条线替代执行配置。
菜单映射：系统返回/Home/最近任务/电源都保存为 key+对应 keyCode；判断存在保存为 assertExists+flow.nodeKind="condition"；开始/结束画面变化都保存为 visualChange，通过 role 和配对 ID 区分。生成脚本时不要使用 keyBack、keyHome、popupCondition、visualChangeStart 等菜单快捷名称作为 type。
`;
