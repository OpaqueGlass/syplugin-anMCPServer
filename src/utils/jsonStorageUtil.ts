import { CONSTANTS } from '@/constants';
import { debugPush, errorPush } from '@/logger';
import { putJSONFile, getJSONFile } from '@/syapi/index';

/**
 * 定义存储数据的基本约束
 */
interface StorageData {
    [key: string]: any;
}

export class JSONStorage<T extends StorageData> {
    private filePath: string;
    private delay: number;
    private data: T;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private isInitialized: boolean = false;

    /**
     * @param filePath 文件的保存路径
     * @param initialData 默认初始数据
     * @param delay 延迟写入的毫秒数 (默认 500ms)
     */
    constructor(filePath: string, initialData: T = {} as T, delay: number = 500) {
        this.filePath = CONSTANTS.PLUGIN_DATA_SAVEPATH + filePath;
        this.delay = delay;
        this.data = initialData;
    }

    /**
     * 初始化：从远程服务器加载现有数据
     */
    async init(): Promise<T> {
        try {
            const remoteData = await getJSONFile(this.filePath);
            if (remoteData) {
                // 将远程数据合并到本地
                this.data = { ...this.data, ...remoteData };
            }
        } catch (error) {
            errorPush(`[JSONStorage] 初始化加载失败: ${this.filePath}`, error);
        } finally {
            this.isInitialized = true;
        }
        return this.data;
    }

    /**
     * 获取指定 Key 的值
     */
    async get<K extends keyof T>(key: K): Promise<T[K]> {
        if (!this.isInitialized) {
            await this.init();
        }
        return this.data[key];
    }

    /**
     * 设置 Key-Value 并触发防抖保存
     */
    set<K extends keyof T>(key: K, value: T[K]): void {
        this.data[key] = value;
        if (value === undefined) {
            delete this.data[key];
        }
        this._triggerSave();
    }

    /**
     * 获取整个对象副本
     */
    async getAll(): Promise<T> {
        if (!this.isInitialized) {
            await this.init();
        }
        return { ...this.data };
    }

    /**
     * 内部私有方法：处理防抖写入逻辑
     */
    private _triggerSave(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(async () => {
            await this.flush();
        }, this.delay);
    }

    /**
     * 立即将内存数据写入文件（刷盘）
     */
    async flush(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        try {
            await putJSONFile(this.filePath, this.data, true);
            debugPush(`[JSONStorage] 数据已成功同步至: ${this.filePath}`);
        } catch (error) {
            errorPush(`[JSONStorage] 自动保存失败: ${this.filePath}`, error);
        }
    }
}