import { debugPush, logPush } from "@/logger";
import {IndexProvider} from "@/indexer/baseIndexProvider";
import { isValidStr } from "@/utils/commonCheck";

type QueryResult = Record<string, any> | any[] | null;
export class MyIndexProvider extends IndexProvider {
    private base_url: string;
    private api_key: string;

    constructor(baseUrl=undefined, apiKey=undefined) {
        super();
        this.base_url = baseUrl ?? "http://127.0.0.1:26808";
        if (isValidStr(this.base_url)) {
            this.base_url += this.base_url.endsWith("/") ? "api/v1" : "/api/v1";
        }
        this.api_key = apiKey ?? "";
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            "x-api-key": this.api_key,
        };
    }

    async update(id: string, content: string): Promise<void> {
        const url = `${this.base_url}/index`;
        const body = JSON.stringify({ id, content });
        const resp = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body,
        });
        if (!resp.ok) {
            const msg = await resp.text();
            throw new Error(`Index update failed: ${resp.status} - ${msg}`);
        }
    }

    async delete(id: string): Promise<void> {
        const url = `${this.base_url}/index/${encodeURIComponent(id)}`;
        const resp = await fetch(url, {
            method: "DELETE",
            headers: this.headers,
        });
        if (!resp.ok) {
            const msg = await resp.text();
            throw new Error(`Index delete failed: ${resp.status} - ${msg}`);
        }
    }

    async query(query: string, top_k: number = 5): Promise<QueryResult> {
        const url = `${this.base_url}/query`;
        const body = JSON.stringify({ query, top_k });
        const resp = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body,
        });
        if (!resp.ok) {
            const msg = await resp.text();
            throw new Error(`Index query failed: ${resp.status} - ${msg}`);
        }
        const result = await resp.json();
        logPush("result", result);
        return result.result;
    }

    async health() {
        const url = `${this.base_url}/health`;
        try {
            const resp = await fetch(url, {
                method: "GET",
                headers: this.headers,
            });
            if (!resp.ok) {
                return null;
            }
            const result = await resp.json();
            return result;
        } catch (e) {
            debugPush("health check error", e);
            return null;
        }
    }
}