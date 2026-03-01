# Freqtrade Monitor V2 🚀

> 一款基于 React Native 和 Expo 构建的现代化移动端 Freqtrade 机器人监控应用。

## ✨ 特性

- **📊 全新仪表盘**: 实时展示你的总资产、24小时盈亏、活跃机器人的核心指标和小图表。
- **📈 交易管理**: 清晰浏览当前未平仓头寸（Open Positions）并提供平仓操作。
- **📜 交易历史**: 完整的平仓历史记录，包含详细的收益、时长和获利比率。
- **⚙️ 监控与设置**: 快捷启动或停止你的 Freqtrade 机器人，以及查看详细的账户和机器人版本信息。
- **🎨 现代暗黑设计**: 重新设计的统一深色主题 (Dark Mode)，提升弱光环境下的阅读与监控体验，并配有丝滑的操作交互和震动反馈。

## 🛠️ 技术栈

- **前端框架**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **网络请求**: [Axios](https://axios-http.com/)
- **路由管理**: Expo Router
- **图标与动画**: `@expo/vector-icons` & React Native Animated

## 🚀 快速开始

### 1. 安装依赖

确保你已经安装了 Node.js，然后在项目根目录下运行：

```bash
npm install
```

### 2. 启动应用

使用以下命令启动 Expo 开发服务器：

```bash
npx expo start
```

启动后，你可以：
- 下载 **Expo Go** App (iOS / Android)。
- 确保你的手机和电脑连接到了 **同一个局域网 (Wi-Fi)**。
- 使用手机相机（iOS）或 Expo Go 应用内的扫描器（Android）扫描终端中显示的二维码即可预览应用。

## 🔌 连接到你的 Freqtrade

在应用登录页面，你需要提供 Freqtrade API 的地址和身份验证信息。由于是局域网测试手机端：

如果你在本地电脑运行 Freqtrade，URL 不能写 `localhost` 或 `127.0.0.1`，你需要使用电脑的**局域网 IP 地址**或者通过 SSH 端口转发将远端机器人的端口映射到本地局域网。

例如局域网 IP: `http://192.168.1.100:8080`

用户名和密码请参阅你 Freqtrade 配置 `config.json` 中的 `api_server` 设置。

## 📝 许可证

该项目仅限个人学习和监控交流使用。
