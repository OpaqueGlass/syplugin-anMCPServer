import { debugPush } from "@/logger";
import { getJSONFile, putJSONFile, removeFileAPI } from "@/syapi";

// 这是一个简化的锁实现，用于防止异步函数重入。
// 在单线程的JS环境中，它通过一个Promise队列来确保操作按顺序执行。
class AsyncLock {
    private promise = Promise.resolve();

    public async acquire<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.promise = this.promise
                .then(() => fn().then(resolve, reject))
                .catch(() => {}); // 捕获之前的错误，不影响新任务
        });
    }
}

export class CacheQueue<T> {
    private readonly cacheDir: string;
    private readonly readFilePath: string;
    private readonly writeFilePath: string;

    private readCache: T[] = [];
    private isRotating = false;

    // 使用锁来确保对文件的读写和轮换操作是原子性的
    private readonly readLock = new AsyncLock();
    private readonly writeLock = new AsyncLock();

    constructor(cacheDir: string) {
        this.cacheDir = cacheDir;
        // 为简单起见，我们使用 .json 而不是 .jsonl，因为 syapi 的函数似乎是为完整的JSON数组设计的
        this.readFilePath = `${this.cacheDir}/cache_a.json`;
        this.writeFilePath = `${this.cacheDir}/cache_b.json`;
    }

    /**
     * 初始化缓存队列，确保缓存文件存在。
     * 应该在使用队列前调用一次。
     */
    public async init(): Promise<void> {
        const readData = await getJSONFile(this.readFilePath);
        if (readData == null) {
            await putJSONFile(this.readFilePath, [], false);
        }
        const writeData = await getJSONFile(this.writeFilePath);
        if (writeData == null) {
            await putJSONFile(this.writeFilePath, [], false);
        }
    }

    /**
     * 将一个新项目添加到写队列（文件b）中。
     * 此操作是线程安全的。
     * @param item 要添加的项目。
     */
    public async addToQueue(item: T): Promise<void> {
        debugPush("item", item);
        return this.writeLock.acquire(async () => {
            let queue: T[] = [];
            try {
                // 读取文件b的现有内容
                queue = await getJSONFile(this.writeFilePath);
                if (!Array.isArray(queue)) {
                    queue = []; // 如果文件内容不是数组，则重置
                }
            } catch (error) {
                // 文件可能为空或不存在，这没关系
                queue = [];
            }
            // 添加新项目并写回
            queue.push(item);
            await putJSONFile(this.writeFilePath, queue, false);
        });
    }

    /**
     * 将一个新项目添加到写队列（文件b）中。
     * 此操作是线程安全的。
     * @param item 要添加的项目。
     */
    public async batchAddToQueue(items: T[]): Promise<void> {
        return this.writeLock.acquire(async () => {
            let queue: T[] = [];
            try {
                // 读取文件b的现有内容
                queue = await getJSONFile(this.writeFilePath);
                if (!Array.isArray(queue)) {
                    queue = []; // 如果文件内容不是数组，则重置
                }
            } catch (error) {
                // 文件可能为空或不存在，这没关系
                queue = [];
            }
            // 添加新项目并写回
            queue.push(...items);
            await putJSONFile(this.writeFilePath, queue, false);
        });
    }

    /**
     * 从读队列（文件a）中消费指定数量的项目。
     * 如果文件a消费完毕，它会自动轮换文件b为新的文件a。
     * 此操作是线程安全的。
     * @param count 希望消费的项目的数量。
     * @returns 一个包含已消费项目的数组。
     */
    public async consume(count: number): Promise<T[]> {
        return this.readLock.acquire(async () => {
            // 如果内存缓存为空，则从文件a加载
            if (this.readCache.length === 0) {
                await this.preloadCacheFromFile();
            }

            // 如果缓存仍然为空，说明文件a是空的，尝试进行文件轮换
            if (this.readCache.length === 0) {
                await this.rotateFiles();
                // 轮换后再次尝试从新的文件a加载
                await this.preloadCacheFromFile();
            }

            // 如果在所有尝试之后缓存仍然为空，则说明整个队列都是空的
            if (this.readCache.length === 0) {
                return [];
            }

            // 从内存缓存中取出所需数量的项目
            const consumedCount = Math.min(count, this.readCache.length);
            const consumedItems = this.readCache.splice(0, consumedCount);

            return consumedItems;
        });
    }

    /**
     * 内部方法：从读文件（文件a）加载内容到内存缓存。
     * 加载后，文件a将被清空。
     */
    private async preloadCacheFromFile(): Promise<void> {
        try {
            const data = await getJSONFile(this.readFilePath);
            if (Array.isArray(data) && data.length > 0) {
                this.readCache = data;
                // 清空文件a，因为内容已在内存中
                await putJSONFile(this.readFilePath, [], false);
            }
        } catch (e) {
            // 文件为空或不存在，缓存保持为空
            this.readCache = [];
        }
    }

    /**
     * 轮换文件：将文件b的内容移动到文件a，然后清空文件b。
     * 这是一个原子操作。
     */
    private async rotateFiles(): Promise<void> {
        // 防止重入
        if (this.isRotating) return;
        this.isRotating = true;

        try {
            // 使用写锁来确保在轮换期间没有新的写入操作干扰
            await this.writeLock.acquire(async () => {
                let itemsToMove: T[] = [];
                try {
                    itemsToMove = await getJSONFile(this.writeFilePath);
                } catch (e) {
                    // 文件b为空或不存在，无需移动
                }

                if (!Array.isArray(itemsToMove) || itemsToMove.length === 0) {
                    // 如果文件b没有内容，则无需轮换
                    return;
                }

                // 将文件b的内容写入文件a
                await putJSONFile(this.readFilePath, itemsToMove, false);

                // 清空文件b
                await removeFileAPI(this.writeFilePath).catch(() => {}); // 忽略删除错误
                await putJSONFile(this.writeFilePath, [], false); // 创建一个新的空文件b
            });
        } finally {
            this.isRotating = false;
        }
    }
}