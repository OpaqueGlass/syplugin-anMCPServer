import { logPush } from "@/logger";

type QueryResult = Record<string, any> | any[] | null;
export class MyIndexProvider extends IndexProvider {
    private base_url: string;
    private api_key: string;

    constructor() {
        super();
        this.base_url = "http://127.0.0.1:26808";
        this.api_key = "";
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
}