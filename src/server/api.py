import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

# The import is now from the new dependencies module
from server.dependencies import get_rag_handler, get_update_queue
from ragwrapper.base_rag_handler import BaseRAGHandler
from server.config import settings
from constants import VERSION

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Security ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_api_key(api_key: str = Security(api_key_header)):
    if settings.auth_key and api_key == settings.auth_key:
        return api_key
    elif not settings.auth_key: # No auth key configured, allow access
        return None
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
        )

# --- Pydantic Models ---
class IndexRequest(BaseModel):
    id: str = Field(..., description="The unique identifier for the document.")
    content: str = Field(..., description="The text content of the document to index.")

class QueryRequest(BaseModel):
    query: str = Field(..., description="The search query.")
    top_k: int = Field(5, gt=0, le=20, description="Number of results to return.")

class QueryResponse(BaseModel):
    result: str | None

class ApiResponse(BaseModel):
    message: str

class HealthResponse(BaseModel):
    status: str
    version: str

# --- API Endpoints ---
@router.get("/health", status_code=status.HTTP_200_OK, response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint that returns the service status and version.
    """
    return {"status": "ok", "version": VERSION}

@router.post("/index", status_code=status.HTTP_202_ACCEPTED, response_model=ApiResponse, dependencies=[Depends(get_api_key)])
async def add_or_update_document(
    request: IndexRequest,
    update_queue: Dict[str, str] = Depends(get_update_queue)
):
    """
    Accepts a document for indexing. The document is added to a queue
    and will be processed shortly. If a document with the same ID is
    already in the queue, its content will be updated.
    """
    logger.info(f"Received indexing request for ID: {request.id}")
    update_queue[request.id] = request.content
    return {"message": "Document accepted and queued for indexing."}

@router.delete("/index/{doc_id}", status_code=status.HTTP_200_OK, response_model=ApiResponse, dependencies=[Depends(get_api_key)])
async def delete_document(
    doc_id: str,
    rag_handler: BaseRAGHandler = Depends(get_rag_handler)
):
    """
    Deletes a document from the index immediately by its ID.
    """
    try:
        logger.info(f"Received deletion request for ID: {doc_id}")
        await rag_handler.delete(doc_ids=[doc_id])
        return {"message": f"Document with ID '{doc_id}' deleted successfully."}
    except Exception as e:
        logger.error(f"Failed to delete document {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query", status_code=status.HTTP_200_OK, response_model=QueryResponse, dependencies=[Depends(get_api_key)])
async def query_documents(
    request: QueryRequest,
    rag_handler: BaseRAGHandler = Depends(get_rag_handler)
):
    """
    Performs a hybrid search query on the indexed documents.
    """
    try:
        logger.info(f"Received query: '{request.query}'")
        result = await rag_handler.query(request.query, top_k=request.top_k)
        return {"result": result}
    except Exception as e:
        logger.error(f"Failed to execute query: {e}")
        raise HTTPException(status_code=500, detail=str(e))