from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, col
from ..database.database import get_session
from ..database.models import RawInput
from ..core.ai_processor import ai_processor
from ..core.settings import settings
from ..core.vector_store import vector_store
import json

router = APIRouter()

@router.get("/")
async def list_raw_inputs(limit: int = 50, offset: int = 0, session: Session = Depends(get_session)):
    """List all raw inputs, newest first."""
    statement = select(RawInput).order_by(RawInput.created_at.desc()).offset(offset).limit(limit)
    results = session.exec(statement).all()
    return results

@router.get("/{input_id}")
async def get_raw_input(input_id: int, session: Session = Depends(get_session)):
    """Get a single raw input by ID."""
    item = session.get(RawInput, input_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item

@router.delete("/{input_id}")
async def delete_raw_input(input_id: int, session: Session = Depends(get_session)):
    """Delete a raw input."""
    item = session.get(RawInput, input_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(item)
    session.commit()
    return {"message": "Deleted"}

@router.get("/search/")
async def search_raw_inputs(q: str, limit: int = 20, session: Session = Depends(get_session)):
    """Search raw inputs by content."""
    if not q:
        return []
    statement = select(RawInput).where(
        (col(RawInput.original_input).contains(q)) | 
        (col(RawInput.fetched_content).contains(q)) |
        (col(RawInput.title).contains(q))
    ).limit(limit)
    results = session.exec(statement).all()
    return results

class LibraryChatRequest(BaseModel):
    message: str

# Library uses its own vector store for RawInput items
_library_vector_store = None

def get_library_vector_store():
    global _library_vector_store
    if _library_vector_store is None:
        from ..core.vector_store import VectorStore
        _library_vector_store = VectorStore(cache_dir=".vector_cache_library")
    return _library_vector_store

async def generate_library_sse_response(query: str, session: Session):
    """Generate SSE stream for library chat response."""
    
    # Get ALL raw inputs
    all_items_stmt = select(RawInput).order_by(RawInput.created_at.desc())
    all_items = session.exec(all_items_stmt).all()
    
    print(f"[Library Chat] Query: '{query}', Total items: {len(all_items)}, Mode: {settings.retrieval_mode}")
    
    if not all_items:
        yield f"event: sources\ndata: []\n\n"
        async for chunk in ai_processor.answer_question_stream(query, "知识库中暂无任何记录。"):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
    
    relevant_items = []
    
    if settings.retrieval_mode == "rag":
        try:
            lib_store = get_library_vector_store()
            # Build index for library items
            items_for_index = [
                {"id": item.id, "label": item.title or "无标题", "content": item.fetched_content or item.original_input}
                for item in all_items
            ]
            lib_store.build_index(items_for_index)
            
            # Search
            results = lib_store.search(query, top_k=10)
            if results:
                item_ids = [item_id for item_id, score in results]
                id_to_item = {item.id: item for item in all_items}
                relevant_items = [id_to_item[iid] for iid in item_ids if iid in id_to_item]
                print(f"[Library/RAG] Found {len(relevant_items)} items via vector search")
        except Exception as e:
            print(f"[Library/RAG] Vector search failed: {e}, falling back to basic")
    
    if not relevant_items:
        # Basic Mode fallback
        keywords = [k.strip().lower() for k in query.split() if len(k.strip()) > 1]
        
        if keywords:
            scored_items = []
            for item in all_items:
                score = 0
                title_lower = (item.title or "").lower()
                content_lower = (item.fetched_content or item.original_input or "").lower()
                
                for kw in keywords:
                    if kw in title_lower:
                        score += 3
                    if kw in content_lower:
                        score += 1
                
                if score > 0:
                    scored_items.append((item, score))
            
            scored_items.sort(key=lambda x: x[1], reverse=True)
            relevant_items = [item for item, s in scored_items[:10]]
        
        if not relevant_items:
            relevant_items = all_items[:15]
        
        print(f"[Library/Basic] Using {len(relevant_items)} items")
    
    # Build context
    context_str = "\n\n---\n\n".join([
        f"【标题: {item.title or '无标题'}】\n类型: {item.input_type}\n内容:\n{item.fetched_content or item.original_input}"
        for item in relevant_items
    ])
    
    if len(context_str) > 12000:
        context_str = context_str[:12000] + "\n\n[...内容过长，已截断...]"

    # Send sources
    sources = [{"id": item.id, "title": item.title or item.original_input[:30]} for item in relevant_items]
    yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
    
    # Stream the answer
    async for chunk in ai_processor.answer_question_stream(query, context_str):
        yield f"data: {json.dumps({'content': chunk})}\n\n"
    
    yield "event: done\ndata: {}\n\n"

@router.post("/chat")
async def library_chat(request: LibraryChatRequest, session: Session = Depends(get_session)):
    """AI Q&A based on raw inputs with SSE streaming."""
    return StreamingResponse(
        generate_library_sse_response(request.message, session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.delete("/clear/all")
async def clear_all_raw_inputs(session: Session = Depends(get_session)):
    """Delete all raw inputs."""
    items = session.exec(select(RawInput)).all()
    for item in items:
        session.delete(item)
    session.commit()
    # Clear library vector cache too
    try:
        lib_store = get_library_vector_store()
        lib_store.clear()
    except:
        pass
    return {"message": f"Cleared {len(items)} items"}
