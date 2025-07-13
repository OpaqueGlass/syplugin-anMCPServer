import os
from typing import List, Any
class BaseRAGHandler:
    def __init__(self, working_base_dir: str, handler_base_name: str):
        if not os.path.exists(working_base_dir):
            os.mkdir(working_base_dir)
        self.working_dir = os.path.join(working_base_dir, handler_base_name)
        if not os.path.exists(self.working_dir):
            os.mkdir(self.working_dir)

    async def initialize(self):
        """Initializes the LightRAG instance."""
        pass
        raise NotImplementedError()

    async def insert(self, ids: List[str], contents: List[str]):
        """Inserts or updates documents."""
        pass
        raise NotImplementedError()

    async def delete(self, doc_ids: List[str]):
        """Deletes documents by their IDs."""
        pass
        raise NotImplementedError()

    async def query(self, query_text: str, top_k: int = 5) -> Any:
        """Performs a query against the indexed documents."""
        pass
        raise NotImplementedError()
    
    async def stop(self):
        pass
        raise NotImplementedError()