# 全局侧边栏（想喝/推荐）页面设计说明（Desktop-first）

## Global Styles（全局设计约束）
- 设计基调：Apple-style 卡片 UI，白底 + 轻阴影，圆角偏大。
- 颜色 Token（建议）：
  - --bg: #F9FAFB（页面背景浅灰）
  - --card: #FFFFFF
  - --text: #111827
  - --muted: #6B7280
  - --border: #F3F4F6
  - --overlay: rgba(0,0,0,0.40)
  - --primary: #000000
- 字体：系统字体栈（system-ui / -apple-system）。
- 圆角：主卡片 28~40px；按钮 16~24px。
- 动效：侧边栏滑入/滑出 200~260ms，使用 ease-out；遮罩淡入/淡出同步。

## Layout（响应式与容器）
- Desktop-first：页面整体居中，主容器 max-width 420~480px（与现有 max-w-md 一致），左右留白。
- 侧边栏为“右侧抽屉 Drawer”覆盖层：
  - Desktop：抽屉宽度 360px（最大不超过视口 90vw）。
  - Mobile：抽屉宽度 86vw（最大 360px）。
- 遮罩覆盖整个 viewport，抽屉位于最上层（z-index 高于浮动导航）。

---

## 页面：今日（Home/今日 Tab）

### Meta Information
- title: 今日｜Drink Scanner
- description: 今日探索、活动与灵感推荐。
- og:title/og:description 与 title/description 同步。

### Page Structure
- 采用纵向堆叠：标题区 + 内容区（活动/探索等）+ 底部浮动导航。
- 新增“右上角三横线入口按钮”为全局浮层按钮，不占用原有内容流。

### Sections & Components
1. 顶部右上角三横线按钮（全局）
   - 位置：fixed；top 20px；right 20px（在主容器内对齐右侧边缘）。
   - 形态：圆形按钮 40x40；背景 #F3F4F6；图标为三横线。
   - 交互：
     - hover：背景加深（#E5E7EB），轻微阴影。
     - active：scale(0.98)。
     - click：打开侧边栏 Drawer。

2. 侧边栏 Drawer（见“全局组件：侧边栏”）

---

## 页面：足迹（Footprint/足迹 Tab）

### Meta Information
- title: 足迹｜Drink Scanner
- description: 记录与查看你的饮品足迹与统计。
- og:title/og:description 与 title/description 同步。

### Page Structure
- 纵向堆叠：标题区 + 统计卡片区 + 历史列表 + 底部浮动导航。
- 同样新增右上角三横线入口按钮（fixed），保证在滚动列表中始终可用。

### Sections & Components
1. 顶部右上角三横线按钮（全局）
   - 与“今日”页规格一致；避免与右下角“+”悬浮按钮发生视觉冲突。

2. 侧边栏 Drawer（见“全局组件：侧边栏”）

---

## 全局组件：侧边栏（Drawer）

### Meta Information
- 作为全局组件，无独立路由；由“今日/足迹”触发。

### Page Structure
- 覆盖层结构：
  - Overlay（遮罩层，全屏）
  - Drawer Panel（右侧面板）

### Sections & Components
1. Overlay 遮罩层
   - 背景：--overlay。
   - 点击：关闭 Drawer。
   - 动效：opacity 0 -> 1。

2. Drawer Panel
   - 背景：白色；左侧阴影；圆角：左上/左下 28px。
   - 顶部区域（Profile Header）：
     - 左：头像（48x48 圆形，支持图片；无图则用默认占位）。
     - 中：可选显示“你好/用户ID”（若无账号体系可隐藏）。
     - 右：关闭按钮（X，36x36 圆形浅灰底）。

3. 分组收纳区（Accordion）
   - 分组：
     - 「想喝」(group_key=want)
     - 「推荐」(group_key=recommend)
   - 分组头：
     - 左：分组标题（加粗）
     - 右：展开/收起箭头；以及“新增”小按钮（+）。
   - 交互：点击分组头展开/收起；点击“+”打开“新增条目”表单。

4. 条目列表（List）
   - 每条：卡片式行高自适应。
   - 内容：
     - 标题（必填，单行截断）
     - 备注（可选，最多两行）
     - 缩略图（可选，40x40 圆角 12px）
   - 操作：
     - 行内“更多/编辑”入口（可用笔形图标），提供编辑/删除。

5. 新增/编辑条目表单（Drawer 内弹出层或分组内展开）
   - 字段：标题（必填）、备注（选填）、图片链接（选填）。
   - CTA：保存（primary 黑底白字）、取消（灰底）。
   - 校验：标题为空时禁用保存并提示。

### 状态规范
- Empty：分组无条目时显示空态文案“还没有条目，先加一个吧”。
- Loading：首次打开 Drawer 时显示 skeleton（可选）。
- Error：存储失败时提示“保存失败，请重试”，不阻塞关闭操作。

### 动效与可用性
- 打开：Panel 从右侧 translateX(100%) -> 0。
- 关闭：反向动画；Overlay 同步淡出。
- 无障碍：
  - ESC 关闭（桌面端）。
  - Focus trap（可选，保证键盘操作不会跳到页面底部）。
  - aria-label：三横线按钮/关闭按钮/新增按钮。