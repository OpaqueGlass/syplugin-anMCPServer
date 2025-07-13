import { CacheQueue } from "@/indexer";
import { IndexProvider } from "@/indexer/baseIndexProvider";
import { IndexConsumer } from "@/indexer/indexConsumer";
import { MyIndexProvider } from "@/indexer/myProvider";

let provider: IndexProvider;
let indexer: CacheQueue<QueueDocIdItem> = new CacheQueue("data/storage/petal/syplugin-anMCPServer");

let indexConsumer = new IndexConsumer();

export function useQueue():CacheQueue<QueueDocIdItem> {
    return indexer;
}

export function useProvider(): IndexProvider {
    return provider;
}

export function useConsumer(): IndexConsumer {
    return indexConsumer;
}

export function setIndexProvider(ip) {
    provider = ip;
}