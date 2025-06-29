import { errorPush } from "@/logger";
import { exportMdContent, getJSONFile, listFileAPI, putJSONFile, removeFileAPI } from "@/syapi";

interface NoteSendIndexerOptions {
    cacheDir: string;            // 缓存文件目录
    saveDelayMs?: number;        // 自动保存延迟，默认5秒
    maxCacheFiles?: number;      // 最大缓存编号数，默认10，超过后回到001
    indexConcurrency?: number;   // 索引并发数，默认3
    idxFilePrefix?: string;      // 缓存文件前缀，默认 idx_cache_
}

export class NoteSendIndexer {
    private memSet: Set<string> = new Set();
    private saveTimer: any | null = null;
    private readonly cacheDir: string;
    private readonly saveDelayMs: number;
    private readonly maxCacheFiles: number;
    private readonly indexConcurrency: number;
    private readonly idxFilePrefix: string;
    private indexing: boolean = false;
    private currentIdxFile: string = '';
    private idxSeq: number = 0;
    private provider: IndexProvider;

    constructor(provider: IndexProvider, options: NoteSendIndexerOptions) {
        this.provider = provider;
        this.cacheDir = options.cacheDir;
        this.saveDelayMs = options.saveDelayMs ?? 5000;
        this.maxCacheFiles = options.maxCacheFiles ?? 10;
        this.indexConcurrency = options.indexConcurrency ?? 3;
        this.idxFilePrefix = options.idxFilePrefix ?? "idx_cache_";
        this.initFromDisk().catch(console.error);
    }

    /**
     * 初始化时扫描磁盘文件，设置idxSeq，恢复currentIdxFile
     */
    private async initFromDisk() {
        const files = await listFileAPI(this.cacheDir);
        // 找最大编号
        let maxSeq = 0;
        const idxFileRegex = new RegExp(`^${this.idxFilePrefix}(\\d{3})\\.json$`);
        for (const f of files) {
            if (!f.isDir && idxFileRegex.test(f.name)) {
                const m = f.name.match(idxFileRegex);
                if (m) {
                    const n = Number(m[1]);
                    if (n > maxSeq) maxSeq = n;
                }
            }
        }
        // 设置下一个编号
        this.idxSeq = maxSeq;
        this.currentIdxFile = this.idxFilePrefix + this.padNum(this.idxSeq + 1) + ".json";
    }

    /**
     * 更新内存缓存，添加id（去重）
     */
    public update(id: string): void {
        this.memSet.add(id);
        this.scheduleSave();
    }

    /**
     * 立刻保存内存中的id到磁盘
     */
    public async saveNow(): Promise<void> {
        if (this.memSet.size === 0) return;
        await this.saveToDisk();
    }

    /**
     * 立刻开始索引流程
     */
    public async indexNow(): Promise<void> {
        if (this.indexing) return;
        this.indexing = true;
        try {
            // 刷新内存缓存到磁盘
            if (this.memSet.size > 0) await this.saveToDisk();

            // 列举目录下所有idx文件
            const files = await listFileAPI(this.cacheDir);
            const idxFileRegex = new RegExp(`^${this.idxFilePrefix}(\\d{3})\\.json$`);
            const idxFiles = files
                .filter(f => !f.isDir && idxFileRegex.test(f.name))
                .map(f => f.name);

            // 索引所有文件（不包含还未写入的新currentIdxFile）
            for (const file of idxFiles) {
                if (file === this.currentIdxFile) continue;
                const path = `${this.cacheDir}/${file}`;
                let idList: string[] = [];
                try {
                    idList = await getJSONFile(path);
                    if (!Array.isArray(idList)) continue;
                } catch {
                    continue;
                }
                await this.indexIdList(idList);
                await removeFileAPI(path).catch(() => { });
            }
        } finally {
            this.indexing = false;
        }
    }

    /**
     * 内部调度定时保存
     */
    private scheduleSave(): void {
        if (this.saveTimer) return; // 已有未触发的定时器
        this.saveTimer = setTimeout(() => {
            this.saveToDisk().finally(() => {
                this.saveTimer = null;
            });
        }, this.saveDelayMs);
    }

    /**
     * 保存内存中的id到磁盘文件
     */
    private async saveToDisk(): Promise<void> {
        if (this.memSet.size === 0) return;
        // 切换文件名（循环）
        this.rotateCacheFile();
        const path = `${this.cacheDir}/${this.currentIdxFile}`;
        await putJSONFile(path, Array.from(this.memSet), false);
        this.memSet.clear();
    }

    /**
     * 每次保存时，切换缓存文件名，避免过长
     */
    private rotateCacheFile(): void {
        this.idxSeq = (this.idxSeq % this.maxCacheFiles) + 1;
        this.currentIdxFile = this.idxFilePrefix + this.padNum(this.idxSeq) + ".json";
    }

    private padNum(n: number): string {
        return n.toString().padStart(3, '0');
    }

    /**
     * 限制并发地索引id列表
     */
    private async indexIdList(ids: string[]): Promise<void> {
        let idx = 0;
        const concurrency = this.indexConcurrency;
        const tasks: Promise<void>[] = [];
        const next = async () => {
            while (true) {
                const i = idx++;
                if (i >= ids.length) break;
                await this.indexSingle(ids[i]);
            }
        };
        for (let i = 0; i < concurrency; i++) {
            tasks.push(next());
        }
        await Promise.all(tasks);
    }

    /**
     * 单个id的索引
     */
    private async indexSingle(id: string): Promise<void> {
        try {
            const { content } = await exportMdContent({ id, refMode: 4, embedMode: 1, yfm: false });
            await this.provider.update(id, content);
        } catch (e) {
            // 出错可记录日志或忽略
            errorPush(`Index id=${id} failed:`, e);
        }
    }
}