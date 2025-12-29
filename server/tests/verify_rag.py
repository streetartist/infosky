
import sys
import os
import shutil

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from server.core.vector_store import vector_store

def mock_node(id, label, content):
    return {"id": id, "label": label, "content": content}

def test_incremental_indexing():
    print("--- Starting Test ---")
    
    # Clean slate
    vector_store.clear()
    
    nodes_batch_1 = [
        mock_node(1, "Python", "A programming language."),
        mock_node(2, "Java", "Another programming language."),
    ]
    
    print("\n[Step 1] Initial Build (Should compute 2 embeddings)")
    vector_store.build_index(nodes_batch_1)
    
    # Reload from disk to verify persistence
    print("\n[Step 2] Reloading VectorStore to check persistence...")
    vector_store._load_cache()
    if len(vector_store.cached_embeddings) == 2:
        print("PASS: Cache persisted correctly.")
    else:
        print(f"FAIL: Cache size is {len(vector_store.cached_embeddings)}, expected 2")

    nodes_batch_2 = nodes_batch_1 + [
        mock_node(3, "Rust", "A systems programming language.")
    ]
    
    print("\n[Step 3] Adding 1 new node (Should compute ONLY 1 embedding)")
    # We can't easily capture stdout here without redirecting, but the logs will show in the output tool.
    vector_store.build_index(nodes_batch_2)
    
    if len(vector_store.cached_embeddings) == 3:
        print("PASS: Cache updated correctly.")
    else:
        print(f"FAIL: Cache size is {len(vector_store.cached_embeddings)}, expected 3")

    # Search check
    print("\n[Step 4] Search Test")
    results = vector_store.search("system language")
    print("Search Results:", results)
    if results and results[0][0] == 3:
        print("PASS: Search found the new node.")
    else:
        print("FAIL: Search did not return expected node.")

if __name__ == "__main__":
    test_incremental_indexing()
