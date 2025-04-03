# 多轨快传-gui

## 1. 简介

**多轨快传gui** 是一款基于aardio开发的Windows桌面应用程序，旨在提供便捷的文件传输监控与管理功能。本应用通过系统托盘图标运行，在后台监控文件传输状态，并提供用户界面以查看当前传输和历史记录。

本应用的文件传输内核基于开源项目 [HybridFileXfer](https://github.com/weixiansen574/HybridFileXfer) 进行二次开发。HybridFileXfer 是一个混合文件传输工具，支持多种传输协议和多线程并发传输，从而实现快速、稳定的文件传输。

### 1.1 HybridFileXfer 简介

HybridFileXfer 是一个强大的文件传输工具，具有以下特点：

*   **多协议支持**：支持 ADB 等多种传输协议。
*   **多线程并发**：通过多线程技术，充分利用带宽，提高传输速度。
*   **断点续传**：支持断点续传功能，避免因网络中断导致的文件传输失败。
*   **跨平台**：HybridFileXfer 可以在多种操作系统上运行。

### 1.2 开源协议

本项目与 HybridFileXfer 保持一致的开源协议，具体请参考 HybridFileXfer 项目的开源协议。

## 2. 功能特性

*   **托盘常驻**：程序可最小化到系统托盘，不占用桌面空间。
*   **实时监控**：实时显示当前文件传输的状态，包括文件名、进度等。
*   **历史记录**：记录所有已完成的传输，方便用户查看和管理。
*   **筛选与搜索**：提供多种筛选条件（传输类型、状态、文件类型）和搜索功能，快速定位目标文件。
*   **文件管理**：支持打开文件所在目录，方便用户进行后续操作。
*   **删除记录**：支持删除历史记录和本地文件，清理不必要的信息。

## 3. 软件架构

### 3.1 技术栈与引擎

本应用使用以下技术栈和引擎：

*   **aaardio**：用于开发Windows桌面应用程序。
*   **HTML/CSS/JavaScript**：用于构建用户界面。
*   **IndexedDB**：用于存储历史记录数据。
*   **webview2控件**：作为前端页面显示引擎。
*   **JRE**：用于运行 HybridFileXfer。
*   **ADB**：用于设备连接和文件传输。
*   **HybridFileXfer**：作为文件传输的核心引擎。(与原版区别：添加一个传输状态监控服务器用于监视传输状态并生成json文件，然后前端通过webview2控件加载该json文件并js解析后显示。)


### 3.2 目录结构

```
多轨快传gui/
├── .build/                      # 编译前后执行脚本，aardio IDE自带
├── dlg/                         # 对话框和窗口代码目录
│   ├── HybridFileXfer.aardio    # 启动 HybridFileXfer 核心传输服务的代码
│   ├── javatest.aardio          # JRE 检测与下载代码
├── JAR/                         # 存放 HybridFileXfer JAR 包和前端资源
│   ├── HybridFileXfer-1.0.jar   # HybridFileXfer Java 程序
│   └── www/                     # 前端资源
│       ├── css/                 # 样式文件
│       ├── js/                  # JavaScript 脚本
│       ├── index.html           # 主页
├── lib/                         # 库文件
│   └── config.aardio          # 配置文件
├── res/                         # 资源文件
│   └── logo.ico               # 应用程序图标
├── default.aproj                # aardio 工程文件
└── main.aardio                  # 主程序入口
```

### 3.3 模块说明

*   **main.aardio**：主程序入口，负责创建窗口、初始化UI、加载 web页面，以及处理与前端的交互。
*   **dlg/HybridFileXfer.aardio**：负责启动 HybridFileXfer 核心传输服务，并设置ADB设备序列号。
*   **dlg/javatest.aardio**：检测 JRE 环境，如果不存在则自动下载并安装。
*   **JAR/www/**：包含前端 HTML、CSS 和 JavaScript 文件，用于构建用户界面。

## 4. 详细设计

### 4.1 JRE环境检测与安装

javatest.aardio 负责检测 JRE 环境，如果不存在则自动下载并安装。

1.  **检测 JRE**：使用 `fsys.attrib` 函数检测 JRE 是否存在。
2.  **下载 JRE**：如果 JRE 不存在，则显示下载对话框，并从指定 URL 下载 JRE 安装包。
3.  **解压 JRE**：下载完成后，使用 `zlib.unzip.extract` 函数解压 JRE 安装包到指定目录。
4.  **清理**：解压完成后，删除下载的安装包。

### 4.2 HybridFileXfer 启动

HybridFileXfer.aardio 负责启动 HybridFileXfer 核心传输服务。

1.  **设置设备序列号**：使用 `process.adb.setSerialNo` 函数设置 ADB 设备序列号。
2.  **设置 JRE 路径**：使用 `java.path.setJreHome` 函数设置 JRE 路径。
3.  **启动 HybridFileXfer**：使用 `java.popenProcess` 函数启动 HybridFileXfer JAR 包。
4.  **进程管理**：使用 `prcs.killOnExit()` 确保在程序退出时，HybridFileXfer 进程也被关闭。

### 4.3 前端界面

前端界面使用 HTML、CSS 和 JavaScript 构建，主要功能包括：

*   **显示当前传输状态**：从 API 获取当前传输数据，并实时更新 UI。
*   **显示历史记录**：从 IndexedDB 加载历史记录，并显示在界面上。
*   **提供筛选和搜索功能**：允许用户根据传输类型、状态、文件类型和文件名进行筛选和搜索。
*   **文件管理**：提供打开文件所在目录和直接打开文件的功能。
*   **删除记录**：允许用户删除历史记录和本地文件。

### 4.4 前后端交互

*   **数据获取**：前端通过 `fetch` API 从 `http://localhost:5741/transfers` 获取当前传输数据。
*   **文件操作**：前端通过 `wb.external` 对象调用 Aardio 代码，实现打开文件所在目录、打开文件、删除文件等功能。

## 5. 使用方法

1.  **运行程序**：双击 `多轨快传gui.exe` 运行程序。
2.  **查看传输状态**：程序运行后，会在系统托盘显示一个图标。双击图标可以打开主界面，查看当前传输状态。
3.  **查看历史记录**：在主界面切换到“历史记录”选项卡，可以查看所有已完成的传输。
4.  **筛选和搜索**：使用筛选条件和搜索框，快速定位目标文件。
5.  **文件管理**：点击文件项的“打开文件夹”或"打开文件"按钮，可以打开文件所在目录或打开文件。
6.  **删除记录**：在历史记录中选择要删除的记录，点击“删除选中项”按钮，可以删除选中的记录和本地文件。

## 6. 注意事项

*   为保证运行稳定性，程序会自动下载并安装jre文件。
*   确保设备已连接到计算机，并启动多轨快传app服务器。app下载请转至 [HybridFileXfer](https://github.com/weixiansen574/HybridFileXfer) app下载页面下载。
*   因aardio打包的exe程序会被360误杀，请下载aardio ide自行构建，使用本项目构建的exe程序请自行添加白名单且本人不负任何责任。

## 7. 贡献

欢迎参与本项目的开发和改进！如果您有任何建议或意见，请提交 issue 或 pull request。

## 8. 许可证

本项目与 HybridFileXfer 保持一致的开源协议，具体请参考 HybridFileXfer 项目的开源协议。

希望这份说明文档对您有所帮助！
