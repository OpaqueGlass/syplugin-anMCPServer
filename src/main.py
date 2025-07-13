import argparse
import asyncio
from contextlib import asynccontextmanager
import logging

import uvicorn
from fastapi import FastAPI

from server.api import router as api_router
from server.config import settings
from server.dependencies import initialize_dependencies, process_update_queue, stop_dependencies

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown events for the FastAPI application.
    """
    try:
        # --- Startup ---
        await initialize_dependencies()
        # Start the background task for processing the queue
        asyncio.create_task(process_update_queue())
        logger.info("Background indexing task started.")
        
        yield
    finally:
        await stop_dependencies()
    # --- Shutdown ---
    logger.info("Application shutdown...")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="LightRAG Backend API",
    description="An API for indexing and querying content using LightRAG.",
    lifespan=lifespan
)

# Include the API router
app.include_router(
    api_router,
    prefix="/api/v1",
)

@app.get("/")
async def root():
    return {"message": "LightRAG Backend is running."}

def main():
    """
    Main function to parse arguments and run the Uvicorn server.
    """
    parser = argparse.ArgumentParser(description="LightRAG Backend Server")
    parser.add_argument("--db-path", type=str, default="./lightrag_db", help="Path to the database directory.")
    parser.add_argument("--model-cache-path", type=str, default="./cache", help="Path to the embedding model path directory.")
    parser.add_argument("--embedding-model-name", type=str, default="BAAI/bge-m3", help="Embedding model name.")
    parser.add_argument("--embedding-dim", type=int, default=1024, help="Embedding model's embedding dimention.")
    parser.add_argument("--max-token-size", type=int, default=8192, help="Embedding model's max token size.")
    parser.add_argument("--port", type=int, default=26808, help="Port to listen on.")
    parser.add_argument("--auth-key", type=str, default=None, help="Auth bearer token for API requests.")
    parser.add_argument("--openai-base-url", type=str, default=None, required=True, help="Open ai base url")
    parser.add_argument("--openai-api-key", type=str, default=None, required=True, help="Open ai api key")
    parser.add_argument("--hf-endpoint", type=str, default=None, help="HuggingFace endpoint")
    args = parser.parse_args()

    # Update settings from command-line arguments
    settings.db_path = args.db_path
    settings.port = args.port
    settings.auth_key = args.auth_key
    settings.model_cache_path = args.model_cache_path
    settings.embedding_model_name = args.embedding_model_name
    settings.embedding_dim = args.embedding_dim
    settings.max_token_size = args.max_token_size
    import os
    os.environ["OPENAI_API_BASE"] = args.openai_base_url
    os.environ["OPENAI_API_KEY"] = args.openai_api_key
    if args.hf_endpoint:
        os.environ["HF_ENDPOINT"] = args.hf_enpoint

    logger.info(f"Starting server on port {settings.port}")
    logger.info(f"Database path: {settings.db_path}")
    if settings.auth_key:
        logger.info("API Auth Key is set.")
    else:
        logger.warning("API Auth Key is NOT set. The API is open.")

    # Run the server
    uvicorn.run(app, host="127.0.0.1", port=settings.port)

if __name__ == "__main__":
    main()