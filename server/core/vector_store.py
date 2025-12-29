"""
Vector Store Service for RAG
Uses sentence-transformers for embeddings and FAISS for similarity search.
"""
import os
import json
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path

# Lazy imports to avoid startup delay
_model = None
_faiss = None

def get_embedding_model():
    """Lazy load the embedding model."""
    global _model
    if _model is None:
        print("[VectorStore] Check for embedding model...")
        from sentence_transformers import SentenceTransformer
        
        # Define local path
        # Assuming server runs from 'server' root or we find relative to this file
        # this file is in server/core/vector_store.py
        # We want server/models/bge-small-zh-v1.5
        base_dir = Path(__file__).resolve().parent.parent
        model_dir = base_dir / "models" / "bge-small-zh-v1.5"
        
        if model_dir.exists():
             print(f"[VectorStore] Loading embedding model from local: {model_dir}")
             _model = SentenceTransformer(str(model_dir))
        else:
             print("[VectorStore] Local model not found. Downloading from HuggingFace (mirror)...")
             # Use mirror for better connectivity in China
             os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
             
             try:
                _model = SentenceTransformer('BAAI/bge-small-zh-v1.5')
                
                # Save locally for next time
                print(f"[VectorStore] Saving model to local: {model_dir}")
                model_dir.mkdir(parents=True, exist_ok=True)
                _model.save(str(model_dir))
             except Exception as e:
                 print(f"[VectorStore] Failed to download model: {e}")
                 # Fallback or re-raise depending on strictness. 
                 # For now re-raise because we need the model.
                 raise e

        print("[VectorStore] Model loaded successfully.")
    return _model

def get_faiss():
    """Lazy load FAISS."""
    global _faiss
    if _faiss is None:
        import faiss
        _faiss = faiss
    return _faiss


class VectorStore:
    def __init__(self, cache_dir: str = ".vector_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.index_path = self.cache_dir / "faiss.index"
        self.meta_path = self.cache_dir / "meta.json"
        
        # New: Persistent embedding cache file
        self.embeddings_path = self.cache_dir / "embeddings.npz"
        
        self.index = None
        self.node_ids: List[int] = []  # Maps index position to node ID
        self.cached_embeddings: dict = {}  # id -> np.ndarray (Cache of ALL known embeddings)
        
        self._load_cache()
    
    def _load_cache(self):
        """Load existing index, metadata, and embedding cache from disk."""
        faiss = get_faiss()
        
        # 1. Load FAISS Index and Meta (for current serving)
        if self.index_path.exists() and self.meta_path.exists():
            try:
                self.index = faiss.read_index(str(self.index_path))
                with open(self.meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    self.node_ids = meta.get('node_ids', [])
                print(f"[VectorStore] Loaded active index with {len(self.node_ids)} vectors")
            except Exception as e:
                print(f"[VectorStore] Failed to load index/meta: {e}")
                self.index = None
                self.node_ids = []

        # 2. Load Embedding Cache (Persistent storage)
        if self.embeddings_path.exists():
            try:
                # Allow_pickle=True might be needed if object arrays, but numeric shouldn't need it
                data = np.load(str(self.embeddings_path))
                ids = data['ids']
                vectors = data['vectors']
                self.cached_embeddings = {int(nid): vec for nid, vec in zip(ids, vectors)}
                print(f"[VectorStore] Loaded {len(self.cached_embeddings)} cached embeddings")
            except Exception as e:
                print(f"[VectorStore] Failed to load embedding cache: {e}")
                self.cached_embeddings = {}

    def _save_cache(self):
        """Save active index and metadata to disk."""
        if self.index is not None:
            faiss = get_faiss()
            faiss.write_index(self.index, str(self.index_path))
            with open(self.meta_path, 'w', encoding='utf-8') as f:
                json.dump({'node_ids': self.node_ids}, f)

    def _save_embeddings(self):
        """Save embedding cache to disk."""
        if not self.cached_embeddings:
            return
        
        ids = np.array(list(self.cached_embeddings.keys()), dtype=int)
        # Ensure vectors are same shape, though they should be
        vectors = np.array(list(self.cached_embeddings.values()), dtype='float32')
        
        try:
            np.savez_compressed(str(self.embeddings_path), ids=ids, vectors=vectors)
            # print("[VectorStore] Embedding cache saved")
        except Exception as e:
            print(f"[VectorStore] Failed to save embedding cache: {e}")

    def embed_text(self, text: str) -> np.ndarray:
        """Generate embedding for a single text."""
        model = get_embedding_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.astype('float32')
    
    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts."""
        model = get_embedding_model()
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
        return embeddings.astype('float32')
    
    def build_index(self, nodes: List[dict], force_rebuild: bool = False):
        """
        Incrementally build/update FAISS index.
        Only computes embeddings for new IDs.
        nodes: List of dicts with 'id', 'label', 'content' keys
        """
        if not nodes:
            print("[VectorStore] No nodes to index")
            return
        
        # 1. Identify what needs embedding
        nodes_to_embed = []
        target_ids = []
        
        for node in nodes:
            nid = node['id']
            target_ids.append(nid)
            
            # Check if we need to compute embedding
            # Current simplified logic: If ID exists in cache, assume content hasn't changed.
            # (TODO: Add content hash check for editing support)
            if nid not in self.cached_embeddings:
                nodes_to_embed.append(node)
        
        target_ids.sort()
        
        # 2. Compute missing embeddings
        if nodes_to_embed:
            print(f"[VectorStore] Computing embeddings for {len(nodes_to_embed)} new/modified nodes...")
            texts = [f"{n['label']}: {n['content']}" for n in nodes_to_embed]
            
            new_embeddings = self.embed_batch(texts)
            
            for i, node in enumerate(nodes_to_embed):
                self.cached_embeddings[node['id']] = new_embeddings[i]
            
            # Persist the updated cache immediately
            self._save_embeddings()
        else:
            # print("[VectorStore] No new embeddings needed.")
            pass

        # 3. Check if Index needs update
        # If the set of NIDs in current index matches target IDs, we are good.
        if not force_rebuild and self.index is not None and self.node_ids == target_ids:
            return
        
        # 4. Reconstruct FAISS Index
        # Rebuilding IndexFlatIP is extremely fast (millisecs for <100k nodes)
        # compared to embedding. This handles additions and deletions cleanly.
        print(f"[VectorStore] Reconstructing FAISS index for {len(target_ids)} nodes...")
        
        valid_vectors = []
        valid_ids = []
        
        for nid in target_ids:
            if nid in self.cached_embeddings:
                valid_vectors.append(self.cached_embeddings[nid])
                valid_ids.append(nid)
        
        if not valid_vectors:
            print("[VectorStore] No valid vectors to index.")
            return

        vectors_array = np.stack(valid_vectors)
        
        faiss = get_faiss()
        dimension = vectors_array.shape[1]
        self.index = faiss.IndexFlatIP(dimension)
        self.index.add(vectors_array)
        self.node_ids = valid_ids
        
        self._save_cache()
        print(f"[VectorStore] Index updated. Total vectors: {self.index.ntotal}")

    def search(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        """
        Search for similar nodes.
        Returns: List of (node_id, score) tuples
        """
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Embed query
        query_embedding = self.embed_text(query).reshape(1, -1)
        
        # Search
        scores, indices = self.index.search(query_embedding, min(top_k, self.index.ntotal))
        
        # Map indices to node IDs
        results = []
        for idx, score in zip(indices[0], scores[0]):
            if idx < len(self.node_ids) and idx >= 0:
                results.append((self.node_ids[idx], float(score)))
        
        return results
    
    def add_node(self, node_id: int, label: str, content: str):
        """
        Add a single node.
        Updates cache and effectively rebuilds index via build_index logic 
        (or shortcut if we trust self.index).
        """
        # For consistency, we reuse build_index logic indirectly or 
        # manually update. Simplest is just caching it and adding to current index.
        
        text = f"{label}: {content}"
        embedding = self.embed_text(text) # 1D array
        
        # Update cache
        self.cached_embeddings[node_id] = embedding
        self._save_embeddings()
        
        # Update active Index
        if self.index is None:
             # First time
             faiss = get_faiss()
             self.index = faiss.IndexFlatIP(embedding.shape[0])
        
        # Add to FAISS
        self.index.add(embedding.reshape(1, -1))
        self.node_ids.append(node_id)
        self._save_cache()
    
    def clear(self):
        """Clear the index and the cache."""
        self.index = None
        self.node_ids = []
        self.cached_embeddings = {}
        
        if self.index_path.exists():
            os.remove(self.index_path)
        if self.meta_path.exists():
            os.remove(self.meta_path)
        if self.embeddings_path.exists():
            os.remove(self.embeddings_path)
            
        print("[VectorStore] Index and cache cleared")


# Singleton instance
vector_store = VectorStore()
