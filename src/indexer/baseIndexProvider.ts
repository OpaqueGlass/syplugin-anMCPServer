abstract class IndexProvider {
    abstract update(id: string, content: string): Promise<void>;
    abstract delete(id: string): Promise<void>;
    abstract query(queryText: string): Promise<any>;
};