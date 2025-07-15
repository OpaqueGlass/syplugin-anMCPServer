import { MyDelayQueue } from "./queue";

const wsIndexQueue = new MyDelayQueue(7);

export function useWsIndexQueue() {
    return wsIndexQueue;
}