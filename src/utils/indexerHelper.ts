import { NoteSendIndexer } from "@/indexer";
import { MyIndexProvider } from "@/indexer/myProvider";

let provider = new MyIndexProvider();
let indexer = new NoteSendIndexer(provider, {cacheDir: "data/storage/petal/syplugin-anMCPServer"});

export function getIndexer() {
    return indexer;
}

export function getProvider() {
    return provider;
}