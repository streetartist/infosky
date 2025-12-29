from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from ..database.database import get_session
from ..database.models import KnowledgeNode, KnowledgeEdge, RawInput
from ..core.ai_processor import ai_processor
from typing import Optional
from ..core.crawler import is_url, fetch_url_content, process_html_content
import re
from datetime import datetime

router = APIRouter()

class IngestRequest(BaseModel):
    text: str
    html_content: Optional[str] = None
    is_manual_selection: bool = False

@router.post("/")
async def ingest_info(request: IngestRequest, session: Session = Depends(get_session)):
    text = request.text
    
    # 0. Check if URL and fetch content
    input_text = text
    fetched_content = None
    title = None
    input_type = "text"
    
    if is_url(text):
        print(f"Detected URL: {text}")
        input_type = "url"
        
        if request.html_content:
            # Use provided HTML content
            print(f"Using provided HTML content (Manual Selection: {request.is_manual_selection})")
            raw_fetched = process_html_content(
                request.html_content, 
                text, 
                extract_main_content=not request.is_manual_selection
            )
        else:
            # Fetch content from URL
            raw_fetched = await fetch_url_content(text)
            
        # Extract title from fetched content
        title_match = re.search(r"Title: (.+?)\n", raw_fetched)
        title = title_match.group(1) if title_match else text[:50]
        
        # Use AI to summarize/clean the content for Knowledge Base
        fetched_content = await ai_processor.summarize_content(raw_fetched, text)
        
        input_text = f"URL: {text}\n\n{raw_fetched}"
    
    # 0.1 Save to RawInput (Knowledge Base) - now with summarized content
    raw_input = RawInput(
        input_type=input_type,
        original_input=text,
        fetched_content=fetched_content,
        title=title
    )
    session.add(raw_input)
    session.commit()
    
    # 0.5 Fetch existing labels for context
    # Get the most recently modified nodes to function as "short-term memory" or "active context"
    statement = select(KnowledgeNode.label).order_by(KnowledgeNode.last_reviewed_at.desc()).limit(50)
    existing_labels = session.exec(statement).all()

    # 1. AI processing
    nodes_data, edges_data = await ai_processor.extract_knowledge(input_text, existing_labels=list(existing_labels))
    
    # 2. Save Nodes
    node_map = {} # label -> db_id
    
    # Determine the source string
    source_info = "User Input"
    if is_url(text):
        source_info = text

    for node_data in nodes_data:
        # Check if exists
        statement = select(KnowledgeNode).where(KnowledgeNode.label == node_data["label"])
        existing_node = session.exec(statement).first()
        
        if existing_node:
            node_map[node_data["label"]] = existing_node.id
            # Update content to prioritize new input, but strictly APPEND to preserve history
            new_content = node_data.get("content", "").strip()
            # Simple check to avoid exact duplicates
            if new_content and new_content not in existing_node.content:
                timestamp = datetime.utcnow().strftime("%Y-%m-%d")
                existing_node.content = f"{existing_node.content}\n\n--- [Updated {timestamp}] ---\n{new_content}"
            
            existing_node.type = node_data.get("type", existing_node.type)
            
            # Update source info (append if new)
            if source_info and source_info != "User Input": 
                 current_source = existing_node.source or ""
                 if source_info not in current_source:
                     if current_source:
                         existing_node.source = f"{current_source}; {source_info}"
                     else:
                         existing_node.source = source_info
            
            existing_node.last_reviewed_at = datetime.utcnow()
            
            session.add(existing_node)
            session.commit()
            session.refresh(existing_node)
        else:
            new_node = KnowledgeNode(
                label=node_data["label"],
                type=node_data.get("type", "Concept"),
                content=node_data.get("content", ""),
                source=source_info
            )
            session.add(new_node)
            session.commit()
            session.refresh(new_node)
            node_map[node_data["label"]] = new_node.id
            
    # 3. Save Edges
    for edge in edges_data:
        source_id = node_map.get(edge["source_label"])
        target_id = node_map.get(edge["target_label"])
        
        if source_id and target_id:
            new_edge = KnowledgeEdge(
                source_id=source_id,
                target_id=target_id,
                relation_type=edge["relation_type"]
            )
            session.add(new_edge)
    
    session.commit()

    return {"message": "Ingested", "nodes_created": len(nodes_data), "edges_created": len(edges_data)}
