import { getJSONFile, putJSONFile } from "@/syapi";

const TASKS_FILE_PATH = '/data/storage/petal/syplugin-anMCPServer';

// 任务状态常量
const TASK_STATUS = {
    PENDING: 0, // 待审阅
    APPROVED: 1, // 已批准
    REJECTED: -1 // 已拒绝
};

class TaskManager {
    private filePath;
    private tasks;
    private nextId;
    constructor(filePath = TASKS_FILE_PATH) {
        this.filePath = filePath;
        this.tasks = [];
        this.nextId = 1;
    }

    /**
     * 初始化：从文件加载任务数据
     */
    async init() {
        const data = await getJSONFile(this.filePath);
        if (data && data.tasks) {
            this.tasks = data.tasks;
            // 确保 nextId 不会重复
            if (this.tasks.length > 0) {
                this.nextId = Math.max(...this.tasks.map(t => t.id)) + 1;
            }
        }
    }

    /**
     * 持久化任务数据到文件
     */
    async #save() {
        await putJSONFile(this.filePath, { tasks: this.tasks }, true);
    }

    /**
     * 插入一个新任务
     * @param {string} id - 任务修改内容的唯一ID
     * @param {object} content - 修改后的内容
     * @param {string} taskType - 任务类型的唯一名称
     * @param {object} args - 任务的其他参数
     * @param {number} status - 任务状态
     * @returns {number} 新任务的唯一ID
     */
    async insert(id, content, taskType, args, status = TASK_STATUS.PENDING) {
        const taskId = this.nextId++;
        const newTask = {
            id: taskId,
            modifiedId: id,
            content: content,
            taskType: taskType,
            args: args,
            status: status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tasks.push(newTask);
        await this.#save();
        return taskId;
    }

    /**
     * 获取任务
     * @param {number} taskId - 任务ID
     * @returns {object|null} 任务对象
     */
    #getTaskById(taskId) {
        return this.tasks.find(task => task.id === taskId);
    }

    /**
     * 标记任务为已批准
     * @param {number} taskId - 任务ID
     */
    async solve(taskId) {
        const task = this.#getTaskById(taskId);
        if (task) {
            task.status = TASK_STATUS.APPROVED;
            task.updatedAt = new Date().toISOString();
            await this.#save();
        }
    }

    /**
     * 标记任务为已拒绝
     * @param {number} taskId - 任务ID
     */
    async reject(taskId) {
        const task = this.#getTaskById(taskId);
        if (task) {
            task.status = TASK_STATUS.REJECTED;
            task.updatedAt = new Date().toISOString();
            await this.#save();
        }
    }

    /**
     * 列出所有任务
     * @param {string} sortOrder - 排序方式, 'asc' 或 'desc'
     * @returns {Array<object>} 任务列表
     */
    listAll(sortOrder = 'desc') {
        const sortedTasks = [...this.tasks].sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return sortedTasks;
    }

    /**
     * 列出未被批准的任务
     * @param {string} sortOrder - 排序方式, 'asc' 或 'desc'
     * @returns {Array<object>} 任务列表
     */
    list(sortOrder = 'desc') {
        const pendingTasks = this.tasks.filter(task => task.status === TASK_STATUS.PENDING);
        const sortedPendingTasks = pendingTasks.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return sortedPendingTasks;
    }

    /**
     * 清理任务
     * @param {number} days - 清理几天前的任务
     * @param {boolean} cleanUnapproved - 是否清理未被批准的任务
     */
    async clean(days, cleanUnapproved = false) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        this.tasks = this.tasks.filter(task => {
            const isOld = new Date(task.createdAt) < cutoffDate;
            const isUnapproved = task.status === TASK_STATUS.PENDING;

            // 如果任务是旧的
            if (isOld) {
                // 并且是未批准的，但 cleanUnapproved 选项为 false，则保留
                if (isUnapproved && !cleanUnapproved) {
                    return true;
                }
                // 否则删除
                return false;
            }
            // 如果任务不旧，则保留
            return true;
        });

        await this.#save();
    }

    // 获取指定任务
    getTask(taskId) {
        return this.#getTaskById(taskId);
    }
}

export const taskManager = new TaskManager();