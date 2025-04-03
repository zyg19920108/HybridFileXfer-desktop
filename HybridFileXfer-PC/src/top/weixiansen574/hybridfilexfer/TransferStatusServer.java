package top.weixiansen574.hybridfilexfer;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
public class TransferStatusServer {
    private static class TransferStatus {
        String path;
        double progress;
        double currentSize;
        double totalSize;
        String type;

        public TransferStatus(String path, double progress, double currentSize, double totalSize, String type) {
            this.path = path;
            this.progress = progress;
            this.currentSize = currentSize;
            this.totalSize = totalSize;
            this.type = type;
        }
    }

    // 修改为 ConcurrentLinkedDeque 以保持插入顺序
    private static class SpeedInfo {
        String channelName;
        double uploadSpeed;
        double downloadSpeed;

        public SpeedInfo(String channelName, double uploadSpeed, double downloadSpeed) {
            this.channelName = channelName;
            this.uploadSpeed = uploadSpeed;
            this.downloadSpeed = downloadSpeed;
        }
    }

    private static final ConcurrentLinkedDeque<TransferStatus> currentTransfers = new ConcurrentLinkedDeque<>();
    private static final ConcurrentLinkedDeque<SpeedInfo> speedInfos = new ConcurrentLinkedDeque<>(); // 新增速度队列
    private final HttpServer server;

    // 在构造函数中添加新的路由
    public TransferStatusServer(int port) throws IOException {
        server = HttpServer.create(new InetSocketAddress(port), 0);
    
 
        // 原有的JSON API保持不变
        server.createContext("/transfers", exchange -> {
            String response = getCurrentTransferStatusJson();
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.sendResponseHeaders(200, response.getBytes().length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });
    
        // 添加速度API路由
        server.createContext("/speed", exchange -> {
            String response = getSpeedInfoJson();
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.sendResponseHeaders(200, response.getBytes().length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });
    
        // 添加连接状态路由
        server.createContext("/connection-status", exchange -> {
            String response = getConnectionStatusJson();
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.sendResponseHeaders(200, response.getBytes().length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });
    }

    public void start() {
        server.start();
        System.out.println("传输状态监控服务已启动 " + server.getAddress().getPort());
    }

    public void stop() {
        server.stop(0);
        System.out.println("传输状态监控服务已关闭 " + server.getAddress().getPort());
    }

    public static void updateTransferStatus(String path, double progress, double currentSize, double totalSize, String type) {
        // 将所有现有任务的进度设为100%
        for (TransferStatus status : currentTransfers) {
            status.progress = 100.0;
            status.currentSize = status.totalSize;
        }
        // 移除旧的状态（如果存在）
        currentTransfers.removeIf(status -> status.path.equals(path));
        // 添加新的状态到队列尾部
        currentTransfers.addLast(new TransferStatus(path, progress, currentSize, totalSize, type));
    }

    private String getCurrentTransferStatusJson() {
        // 使用LinkedHashMap保持文件夹顺序
        Map<String, List<Map<String, Object>>> folderMap = new LinkedHashMap<>();
        
        // 按文件夹分组（从最新到最旧）
        ConcurrentLinkedDeque<TransferStatus> reversedTransfers = new ConcurrentLinkedDeque<>(currentTransfers);
        for (TransferStatus status : reversedTransfers) {
            // 统一路径格式并获取文件夹路径
            String path = status.path.replace("\\", "/");
            int lastSlash = path.lastIndexOf('/');
            String folder = lastSlash > 0 ? path.substring(0, lastSlash + 1) : "/";
            
            // 如果文件夹不存在则创建，并添加到LinkedHashMap的开头
            if (!folderMap.containsKey(folder)) {
                // 使用LinkedHashMap保持文件插入顺序
                List<Map<String, Object>> fileList = new ArrayList<>();
                folderMap.put(folder, fileList);
            }
            
            // 添加文件信息到对应文件夹的开头
            folderMap.get(folder).add(0, createFileInfo(status));
        }

        // 构建JSON字符串
        StringBuilder json = new StringBuilder();
        json.append("{\"transfers\":[");
        
        boolean firstFolder = true;
        // 逆序遍历文件夹（最新添加的在前）
        List<String> folders = new ArrayList<>(folderMap.keySet());
        for (int i = folders.size() - 1; i >= 0; i--) {
            String folder = folders.get(i);
            if (!firstFolder) {
                json.append(",");
            }
            
            json.append("{\"folder\":\"").append(folder.replace("\"", "\\\"")).append("\",");
            json.append("\"files\":[");
            
            boolean firstFile = true;
            // 文件已经按添加顺序逆序排列
            for (Map<String, Object> fileInfo : folderMap.get(folder)) {
                if (!firstFile) {
                    json.append(",");
                }
                
                json.append("{");
                json.append("\"path\":\"").append(fileInfo.get("path")).append("\",");
                json.append("\"progress\":").append(fileInfo.get("progress")).append(",");
                json.append("\"currentSize\":").append(fileInfo.get("currentSize")).append(",");
                json.append("\"totalSize\":").append(fileInfo.get("totalSize")).append(",");
                json.append("\"type\":\"").append(fileInfo.get("type")).append("\"");
                json.append("}");
                
                firstFile = false;
            }
            
            json.append("]}");
            firstFolder = false;
        }
        
        json.append("]}");
        return json.toString();
    }

    private Map<String, Object> createFileInfo(TransferStatus status) {
        Map<String, Object> fileInfo = new LinkedHashMap<>();
        // 将Windows路径分隔符\替换为/，并转义特殊字符
        String escapedPath = status.path.replace("\\", "/")
                                      .replace("\"", "\\\"");
        fileInfo.put("path", escapedPath);
        fileInfo.put("progress", Math.min(status.progress, 100.0));
        fileInfo.put("currentSize", status.progress >= 100.0 ? status.totalSize : status.currentSize);
        fileInfo.put("totalSize", status.totalSize);
        fileInfo.put("type", status.type);
        return fileInfo;
    }

    private String buildJsonFromTree(Map<String, Object> tree) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        boolean first = true;
        
        for (Map.Entry<String, Object> entry : tree.entrySet()) {
            if (!first) {
                json.append(",");
            }
            
            json.append("\"").append(entry.getKey()).append("\":");
            
            if (entry.getValue() instanceof Map) {
                json.append(buildJsonFromTree((Map<String, Object>) entry.getValue()));
            } else if (entry.getValue() instanceof List) {
                json.append("[");
                boolean firstItem = true;
                for (Object item : (List<?>) entry.getValue()) {
                    if (!firstItem) {
                        json.append(",");
                    }
                    if (item instanceof Map) {
                        json.append(buildJsonFromTree((Map<String, Object>) item));
                    }
                    firstItem = false;
                }
                json.append("]");
            } else if (entry.getValue() != null) {
                json.append("\"").append(entry.getValue().toString()).append("\"");
            } else {
                json.append("null");
            }
            
            first = false;
        }
        
        json.append("}");
        return json.toString();
    }

    // 添加更新速度信息的方法
    public static void updateSpeedInfo(String channelName, double uploadSpeedMB, double downloadSpeedMB) {
        // 检查channelName是否为null
        if (channelName == null) {
            return;
        }
        // 移除旧的记录
        speedInfos.removeIf(info -> channelName.equals(info.channelName));
        // 添加新的记录
        speedInfos.addLast(new SpeedInfo(channelName, uploadSpeedMB, downloadSpeedMB));
    }

    // 添加获取速度JSON的方法
    private String getSpeedInfoJson() {
        StringBuilder json = new StringBuilder();
        json.append("{\"speeds\":[");
        boolean first = true;
        for (SpeedInfo info : speedInfos) {
            if (!first) {
                json.append(",");
            }
            json.append(String.format(
                "{\"channel\":\"%s\",\"upload\":%.2f,\"download\":%.2f}",
                info.channelName, info.uploadSpeed, info.downloadSpeed
            ));
            first = false;
        }
        json.append("]}");
        return json.toString();
    }

    // 添加连接状态记录类
    private static class ConnectionStatus {
        String eventType;
        String message;
        long timestamp;
        
        public ConnectionStatus(String eventType, String message) {
            this.eventType = eventType;
            this.message = message;
            this.timestamp = System.currentTimeMillis();
        }
    }
    
    // 添加连接状态队列
    private static final ConcurrentLinkedDeque<ConnectionStatus> connectionStatuses = new ConcurrentLinkedDeque<>();
    
    // 添加更新连接状态的方法
    public static void updateConnectionStatus(String eventType, String message) {
        connectionStatuses.addLast(new ConnectionStatus(eventType, message));
        // 保持队列大小合理，避免内存占用过大
        if (connectionStatuses.size() > 100) {
            connectionStatuses.removeFirst();
        }
    }

    // 添加这个方法到TransferStatusServer类中
    public static void completeAllTransfers() {
        currentTransfers.forEach(status -> {
            status.progress = 100.0;
            status.currentSize = status.totalSize;
        });
    }

    // 添加获取连接状态JSON的方法
    private String getConnectionStatusJson() {
        StringBuilder json = new StringBuilder();
        json.append("{\"connectionStatuses\":[");
        boolean first = true;
        for (ConnectionStatus status : connectionStatuses) {
            if (!first) {
                json.append(",");
            }
            json.append(String.format(
                "{\"eventType\":\"%s\",\"message\":\"%s\",\"timestamp\":%d}",
                status.eventType, 
                status.message.replace("\"", "\\\""),
                status.timestamp
            ));
            first = false;
        }
        json.append("]}");
        return json.toString();
    }
}