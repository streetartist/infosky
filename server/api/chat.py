from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, col, or_
from ..database.database import get_session
from ..database.models import KnowledgeNode
from ..core.ai_processor import ai_processor
from ..core.settings import settings
from ..core.vector_store import vector_store
import json

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

def get_nodes_by_ids(session: Session, node_ids: list) -> list:
    """Fetch nodes by IDs, preserving order."""
    if not node_ids:
        return []
    nodes = session.exec(select(KnowledgeNode).where(KnowledgeNode.id.in_(node_ids))).all()
    # Preserve order from node_ids
    id_to_node = {n.id: n for n in nodes}
    return [id_to_node[nid] for nid in node_ids if nid in id_to_node]

async def generate_sse_response(query: str, session: Session):
    """Generate SSE stream for chat response."""
    
    # 1. Get ALL nodes from the knowledge base
    all_nodes_stmt = select(KnowledgeNode).order_by(KnowledgeNode.created_at.desc())
    all_nodes = session.exec(all_nodes_stmt).all()
    
    print(f"[Chat] Query: '{query}', Total nodes in DB: {len(all_nodes)}, Mode: {settings.retrieval_mode}")
    
    if not all_nodes:
        yield f"event: sources\ndata: []\n\n"
        async for chunk in ai_processor.answer_question_stream(query, "知识库中暂无任何记录。"):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "event: done\ndata: {}\n\n"
        return
    
    relevant_nodes = []
    
    # 2. Choose retrieval method based on settings
    if settings.retrieval_mode == "rag":
        # RAG Mode: Use vector similarity search
        try:
            # Build/update index if needed
            nodes_for_index = [{"id": n.id, "label": n.label, "content": n.content} for n in all_nodes]
            vector_store.build_index(nodes_for_index)
            
            # Search
            results = vector_store.search(query, top_k=15)
            if results:
                node_ids = [node_id for node_id, score in results]
                relevant_nodes = get_nodes_by_ids(session, node_ids)
                print(f"[Chat/RAG] Found {len(relevant_nodes)} nodes via vector search")
        except Exception as e:
            print(f"[Chat/RAG] Vector search failed: {e}, falling back to basic mode")
            settings.retrieval_mode = "basic"  # Temporary fallback
    
    if settings.retrieval_mode == "basic" or not relevant_nodes:
        # Basic Mode: Keyword-based scoring
        keywords = [k.strip().lower() for k in query.split() if len(k.strip()) > 1]
        
        if keywords:
            scored_nodes = []
            for node in all_nodes:
                score = 0
                label_lower = node.label.lower()
                content_lower = node.content.lower() if node.content else ""
                
                for kw in keywords:
                    if kw in label_lower:
                        score += 3
                    if kw in content_lower:
                        score += 1
                
                if score > 0:
                    scored_nodes.append((node, score))
            
            scored_nodes.sort(key=lambda x: x[1], reverse=True)
            relevant_nodes = [n for n, s in scored_nodes[:15]]
        
        if not relevant_nodes:
            relevant_nodes = all_nodes[:20]
        
        print(f"[Chat/Basic] Using {len(relevant_nodes)} nodes")
    
    # 3. Format context
    context_str = "\n\n---\n\n".join([
        f"【{n.label}】(类型: {n.type})\n{n.content}" 
        for n in relevant_nodes
    ])
    
    if len(context_str) > 12000:
        context_str = context_str[:12000] + "\n\n[...内容过长，已截断...]"

    # Send sources
    sources = [{"id": n.id, "label": n.label} for n in relevant_nodes]
    yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
    
    # Stream the answer
    async for chunk in ai_processor.answer_question_stream(query, context_str):
        yield f"data: {json.dumps({'content': chunk})}\n\n"
    
    yield "event: done\ndata: {}\n\n"

@router.post("/")
async def chat_with_graph(request: ChatRequest, session: Session = Depends(get_session)):
    """Stream chat response using Server-Sent Events."""
    return StreamingResponse(
        generate_sse_response(request.message, session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
