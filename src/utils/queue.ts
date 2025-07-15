import { generateUUID } from "./common";
import Mutex from "./mutex";
import { debugPush } from "@/logger";

class Task<T> {
    constructor(
        public id: string,
        public execute: () => Promise<T> | T,
        public enqueueTime: number, // 任务入队时间，由队列维护
        public resolve: (value: T | PromiseLike<T>) => void,
        public reject: (reason?: any) => void
    ) {}
}

export class MyDelayQueue {
    private tasks: Task<any>[] = [];
    private delayTime: number;  // 所有任务的统一延迟时间（秒）
    private timer: NodeJS.Timeout | null = null;

    private mutex: Mutex = new Mutex();

    constructor(delayTime: number) {
        this.delayTime = delayTime * 1000; // 延迟时间转为毫秒
    }

    // 入队任务，返回一个Promise，该Promise将在任务执行后解析
    enqueue<T>(task: () => Promise<T> | T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const enqueueTime = Date.now();
            const taskId = generateUUID();
            const taskWithTime = new Task<T>(taskId, task, enqueueTime, resolve, reject);
            this.tasks.push(taskWithTime);

            if (!this.timer) {
                this.setTimer();
            }
        });
    }

    // 出队任务
    dequeue() {
        return this.tasks.shift();
    }

    signalOne() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.processTask();
    }

    // 设置定时器，每次检查队列中的任务
    private setTimer() {
        if (this.tasks.length === 0) {
            return;
        }
        const nextExecutionTime = this.tasks[0].enqueueTime + this.delayTime;
        const delay = Math.max(0, nextExecutionTime - Date.now());

        this.timer = setTimeout(() => {
            this.processTask();
        }, delay);
    }

    // 处理任务
    private async processTask() {
        if (this.tasks.length === 0) {
            return;
        }
        
        await this.mutex.lock();
        try {
            if (this.tasks.length > 0) {
                const now = Date.now();
                const task = this.tasks[0];
                
                if (now >= task.enqueueTime + this.delayTime) {
                    debugPush(`消费任务检查: ${task.id}`);
                    this.dequeue(); // 先出队，避免重复执行
                    try {
                        const result = await task.execute();
                        task.resolve(result);
                    } catch (error) {
                        task.reject(error);
                    }

                }
            }
        } finally {
            this.mutex.unlock();
            if (this.tasks.length > 0) {
                this.setTimer();
            } else {
                this.timer = null; // 如果队列为空，清除定时器
            }
        }
    }
}