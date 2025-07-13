import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict

from fastapi import dependencies

from ragwrapper.base_rag_handler import BaseRAGHandler
from server.config import settings
from ragwrapper.lightrag import LightRAGHandler

# --- Logging Setup ---
logger = logging.getLogger(__name__)

# --- Shared State ---
# This module now holds the shared instances that were in main.py
update_queue: Dict[str, str] = {}
last_request_time = None
rag_handler: BaseRAGHandler | None = None

# --- Constants ---
PROCESSING_DELAY_SECONDS = 5  # Process queue after 5 seconds of inactivity

# --- Dependency Provider Functions ---
def get_rag_handler() -> BaseRAGHandler:
    """FastAPI dependency to get the shared RAGHandler instance."""
    if not rag_handler:
        # This should not happen in a running app due to the lifespan manager
        raise RuntimeError("RAG Handler not initialized")
    return rag_handler

def get_update_queue() -> Dict[str, str]:
    """FastAPI dependency to get the shared update queue."""
    global last_request_time
    last_request_time = datetime.now()
    return update_queue

# --- Background Task Logic ---
async def process_update_queue():
    """
    A background task that periodically processes the documents in the update_queue.
    """
    global last_request_time
    while True:
        await asyncio.sleep(1)
        if last_request_time and (datetime.now() - last_request_time) > timedelta(seconds=PROCESSING_DELAY_SECONDS):
            if update_queue:
                logger.info(f"Processing batch of {len(update_queue)} documents.")
                try:
                    items_to_process = list(update_queue.items())
                    ids_to_process = [item[0] for item in items_to_process]
                    contents_to_process = [item[1] for item in items_to_process]
                    
                    # Clear the processed items from the queue
                    for doc_id in ids_to_process:
                        if doc_id in update_queue:
                            del update_queue[doc_id]

                    # Perform insertion using the handler
                    await get_rag_handler().insert(ids=ids_to_process, contents=contents_to_process)
                    logger.info(f"Successfully indexed {len(ids_to_process)} documents.")

                except Exception as e:
                    logger.error(f"Error processing update queue: {e}")
                finally:
                    last_request_time = None # Reset timer

# --- Initializer ---
async def initialize_dependencies():
    """
    Initializes the RAG handler. To be called from the app's lifespan.
    """
    global rag_handler
    logger.info("Initializing dependencies...")
    rag_handler = LightRAGHandler(working_base_dir=settings.db_path)
    await rag_handler.initialize()
    logger.info("RAG Handler initialized and ready.")

async def stop_dependencies():
    global rag_handler
    if rag_handler:
        await rag_handler.stop()