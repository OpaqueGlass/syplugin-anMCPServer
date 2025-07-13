import asyncio
import logging
from typing import List, Any

from lightrag import LightRAG, QueryParam
from lightrag.llm.hf import hf_embed
from lightrag.utils import EmbeddingFunc
from ragwrapper.base_rag_handler import BaseRAGHandler
from transformers import AutoModel, AutoTokenizer
from lightrag.kg.shared_storage import initialize_pipeline_status

# openai
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

import nest_asyncio

nest_asyncio.apply()
logger = logging.getLogger(__name__)

# A simple BGE-M3 embedding function using a local cache
# Note: Ensure you have enough memory for the model.
def get_embed_func(model_name: str = "BAAI/bge-m3", embedding_dim: int = 1024, max_token_size: int = 8192, cache_dir: str = "./models_cache"):
    logger.info(f"Initializing {model_name} embedding model...[If you are stuck at this step, please check whether you can connect to the Internet(world wide), or set `--hf-endpoint`]")
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
    model = AutoModel.from_pretrained(model_name, cache_dir=cache_dir)
    logger.info(f"{model_name} embedding model loaded.")

    return EmbeddingFunc(
        embedding_dim=embedding_dim, # bge-m3 has 1024 dimensions
        max_token_size=max_token_size,
        func=lambda texts: hf_embed(
                texts,
                tokenizer=tokenizer,
                embed_model=model,
            ),
    )

class LightRAGHandler(BaseRAGHandler):
    def __init__(self, working_base_dir: str):
        super().__init__(working_base_dir, "lightrag")
        self.rag_instance: LightRAG | None = None

    async def initialize(self):
        """Initializes the LightRAG instance."""
        if self.rag_instance:
            return
        
        logger.info(f"Initializing LightRAG in directory: {self.working_dir}")
        
        # For simplicity, we use OpenAI's embedding as the primary.
        # You can switch to the local BGE model if you have the hardware.
        # Note: Set your OPENAI_API_KEY environment variable.
        # embedding_function = get_bge_m3_embed_func()
        
        self.rag_instance = LightRAG(
            working_dir=self.working_dir,
            llm_model_func=gpt_4o_mini_complete,
            embedding_func=get_embed_func(), # Uses OpenAI's text-embedding-3-small by default
        )
        await self.rag_instance.initialize_storages()
        await initialize_pipeline_status()
        logger.info("LightRAG storages initialized.")

    async def insert(self, ids: List[str], contents: List[str]):
        """Inserts or updates documents."""
        if not self.rag_instance:
            raise RuntimeError("RAG instance not initialized.")
        
        logger.info(f"Inserting/updating {len(ids)} documents.")
        # LightRAG's insert acts as an upsert, so it handles both new and existing IDs.
        self.rag_instance.insert(input=contents, ids=ids)
        logger.info("Insertion complete.")

    async def delete(self, doc_ids: List[str]):
        """Deletes documents by their IDs."""
        if not self.rag_instance or not self.rag_instance.vector_storage:
            raise RuntimeError("RAG vector storage not initialized.")
        
        logger.info(f"Deleting {len(doc_ids)} documents.")
        # Access the underlying vector storage to delete by ID.
        await self.rag_instance.vector_storage.delete_by_ids(ids=doc_ids)
        logger.info("Deletion complete.")

    async def query(self, query_text: str, top_k: int = 5) -> Any:
        """Performs a query against the indexed documents."""
        if not self.rag_instance:
            raise RuntimeError("RAG instance not initialized.")
        
        logger.info(f"Executing query: '{query_text}'")
        # Using hybrid search mode as in your example.
        result = self.rag_instance.query(
            query_text,
            param=QueryParam(mode="hybrid", top_k=top_k)
        )
        return result
    
    async def stop(self):
        if self.rag_instance:
            await self.rag_instance.finalize_storages()
