import { createFolder, getFileAPI, listFileAPI, putStringFile, removeFileAPI } from "@/syapi";
import { debugPush, errorPush } from ".";

// 定义日志项接口
interface LogEntry {
    level: string;
    content: string;
    headerIp: string;
    socketIp: string;
    timestamp: string;
}

export class ConnectionLogger {
    private buffer: string[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private flushQueue: Promise<void> = Promise.resolve();
    
    /**
     * @param systemId 系统ID
     * @param logDir 保存的文件夹路径，例如 "/data/logs"
     * @param bufferSize 缓冲区大小（条数）
     * @param flushInterval 延迟落盘时间（毫秒）
     */
    constructor(
        private systemId: string,
        private logDir: string = "/temp/petal/syplugin-anMCPServer/logs",
        private bufferSize: number = 10,
        private flushInterval: number = 5000
    ) {
        // 确保路径结尾没有斜杠
        this.logDir = logDir.replace(/\/$/, "");
        createFolder(this.logDir).catch(error=>{
            errorPush(`[Logger] Failed to create log directory ${this.logDir}:`, error);
        });
        this.cleanOldLogs().catch(error=>{
            errorPush(`[Logger] Failed to clean old logs:`, error);
        });
    }

    /**
     * 记录日志
     */
    public _log(level: string, content: string, headerIp: string, socketIp: string): void {
        const timestamp = new Date().toISOString();
        // 格式化为一行：时间 [级别] H:IP S:IP - 内容
        const logLine = `${timestamp} [${level.toUpperCase()}] H:${headerIp} S:${socketIp} - ${content}`;
        
        this.buffer.push(logLine);

        if (this.buffer.length >= this.bufferSize) {
            this.triggerFlush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.triggerFlush(), this.flushInterval);
        }
    }

    public info(content: string, headerIp: string, socketIp: string): void {
        this._log("info", content, headerIp, socketIp);
    }
    public debug(content: string, headerIp: string, socketIp: string): void {
        this._log("debug", content, headerIp, socketIp);
    }
    public error(content: string, headerIp: string, socketIp: string): void {
        this._log("error", content, headerIp, socketIp);
    }
    public warn(content: string, headerIp: string, socketIp: string): void {
        this._log("warn", content, headerIp, socketIp);
    }
    public log(content: string, headerIp: string, socketIp: string): void {
        this._log("log", content, headerIp, socketIp);
    }

    /**
     * 触发落盘并清理计时器
     */
    private triggerFlush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.buffer.length === 0) return;

        const logsToWrite = [...this.buffer];
        this.buffer = [];

        this.flushQueue = this.flushQueue.then(() => this.performFlush(logsToWrite));
    }

    /**
     * 执行 I/O 操作
     */
    private async performFlush(newLogs: string[]): Promise<void> {
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `${dateStr}_${this.systemId}.log`;
        const fullPath = `${this.logDir}/${fileName}`;

        try {
            const result = await getFileAPI(fullPath);
            let finalContent: string;

            if (result === null) {
                // 文件不存在，直接写入新内容
                finalContent = newLogs.join('\n');
            } else {
                // 文件已存在，将新日志追加到末尾
                const existingContent = typeof result === 'string' ? result : JSON.stringify(result);
                finalContent = existingContent.endsWith('\n') 
                    ? existingContent + newLogs.join('\n')
                    : existingContent + '\n' + newLogs.join('\n');
            }

            await putStringFile(fullPath, finalContent, false);
            
        } catch (error) {
            errorPush(`[Logger] Failed to flush to ${fullPath}:`, error);
            this.buffer = [...newLogs, ...this.buffer];
        }
    }

    async cleanOldLogs(daysToKeep: number = 7) {
        const files = await listFileAPI(this.logDir);
        if (!files || files.length === 0) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const pad = (n: number) => String(n).padStart(2, '0');
        const cutoffStr = `${cutoffDate.getFullYear()}-${pad(cutoffDate.getMonth() + 1)}-${pad(cutoffDate.getDate())}_${pad(cutoffDate.getHours())}-${pad(cutoffDate.getMinutes())}-${pad(cutoffDate.getSeconds())}`;

        debugPush(`正在清理 ${daysToKeep} 天前的日志，截止时间点: ${cutoffStr}`);
        for (const fileName of files) {
            // 假设文件名类似: 2023-10-27_14-30-05.log
            // 直接进行字符串比较，比解析成 Date 对象效率更高
            if (fileName < cutoffStr) {
                debugPush(`发现过时文件: ${fileName}，准备删除...`);
                await removeFileAPI(`${this.logDir}/${fileName}`); 
            }
        }
    }
}