// 颜色主题定义 - 基于 Stitch 设计稿的暗色主题
// 使用专业金融App风格的深蓝黑背景 + 蓝色强调色 + 绿涨红跌配色

export const Colors = {
  // 暗色主题（主题色）
  dark: {
    // 背景色系列 - 深蓝色调（匹配 Stitch 设计）
    background: '#070B14',       // 主背景 - 极深蓝黑
    surface: '#0D1320',          // 卡片/容器背景 - 深蓝
    surfaceLight: '#141C2E',     // 稍亮的表面（输入框、悬浮态）
    surfaceHighlight: '#1A2540', // 高亮表面（选中态、进度条背景）
    surfaceBorder: '#1E2A3E',    // 边框色 - 微妙分割

    // 文字色
    text: '#F1F5F9',             // 主文字 - 接近白色
    textSecondary: '#94A3B8',    // 次要文字 - 灰蓝
    textMuted: '#506580',        // 更淡的文字 - 暗蓝灰

    // 强调色 - 蓝色系（匹配设计 #57a5ff）
    primary: '#57A5FF',          // 主色调 - 亮蓝
    primaryLight: '#7BBBFF',     // 浅蓝
    primaryDark: '#3D8CE0',      // 深蓝
    primaryBg: 'rgba(87, 165, 255, 0.12)',  // 蓝色背景

    // 状态色 - 交易核心配色
    profit: '#00D68F',           // 盈利/上涨 - 翠绿
    profitLight: '#34E8A5',      // 浅绿
    profitBg: 'rgba(0, 214, 143, 0.12)',    // 绿色背景
    loss: '#FF3D71',             // 亏损/下跌 - 玫红
    lossLight: '#FF6B8A',        // 浅红
    lossBg: 'rgba(255, 61, 113, 0.12)',     // 红色背景

    // 风控等级色
    riskAllow: '#00D68F',        // ALLOW - 绿色
    riskReduce: '#FFAA00',       // REDUCE - 金黄
    riskBlock: '#FF3D71',        // BLOCK - 红色

    // 功能色
    warning: '#FFAA00',          // 警告 - 金黄
    info: '#00CFFD',             // 信息 - 电光蓝
    success: '#00D68F',          // 成功 - 翠绿

    // Tab Bar
    tabBar: '#070B14',           // Tab 栏背景（与主背景一致）
    tabIconDefault: '#506580',   // 未选中图标
    tabIconSelected: '#57A5FF',  // 选中图标

    // 特殊
    overlay: 'rgba(0, 0, 0, 0.7)', // 遮罩层

    // 渐变色起点（用于卡片装饰等）
    gradientStart: 'rgba(87, 165, 255, 0.15)',
    gradientEnd: 'rgba(87, 165, 255, 0.02)',
  },
};

// 字体大小
export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  hero: 32,    // 大标题（总资产等）
  mega: 40,    // 超大标题
};

// 间距
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// 圆角
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};
