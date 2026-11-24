import os
import re
from typing import List, Dict, Any, Optional
import pypdf
import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2
import google.generativeai as genai

from backend.config import GEMINI_API_KEY

# Configure persistent ChromaDB client at ./chroma_data
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_PATH = os.path.join(WORKSPACE_ROOT, "chroma_data")
os.makedirs(CHROMA_PATH, exist_ok=True)

# Point ONNX model cache to local folder inside workspace so it works offline and sandboxed
onnx_cache_dir = os.path.join(CHROMA_PATH, "onnx_cache")
if os.path.exists(onnx_cache_dir):
    ONNXMiniLM_L6_V2.DOWNLOAD_PATH = onnx_cache_dir

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(
    name="smartcorp_docs",
    metadata={"hnsw:space": "cosine"}
)

# Configure Gemini API if key is present with REST transport for strict timeout compliance
active_gemini_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
if active_gemini_key:
    try:
        genai.configure(api_key=active_gemini_key, transport="rest")
    except Exception:
        genai.configure(api_key=active_gemini_key)


def ingest_pdf(file_path: str, filename: str, org_id: int) -> int:
    """
    Extract text page-by-page using PyPDF, split into 500-character chunks
    with 50-character overlap, and store in ChromaDB with metadata
    {"org_id": org_id, "filename": filename, "page": page_idx}.
    Returns total chunk count ingested.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    reader = pypdf.PdfReader(file_path)
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    ids: List[str] = []

    chunk_size = 500
    overlap = 50
    step = chunk_size - overlap  # 450 chars

    for page_idx, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        clean_text = raw_text.strip()
        if not clean_text:
            continue

        start = 0
        chunk_num = 0
        while start < len(clean_text):
            end = min(start + chunk_size, len(clean_text))
            chunk = clean_text[start:end].strip()
            if chunk:
                # Deterministic chunk ID
                chunk_id = f"org_{org_id}_{filename}_p{page_idx}_c{chunk_num}"
                ids.append(chunk_id)
                documents.append(chunk)
                metadatas.append({
                    "org_id": int(org_id),
                    "filename": filename,
                    "page": int(page_idx),
                })
                chunk_num += 1

            if end == len(clean_text):
                break
            start += step

    if ids:
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

    return len(ids)


def get_indexed_documents_count(org_id: int) -> int:
    """Return count of chunks for this org."""
    try:
        results = collection.get(where={"org_id": int(org_id)})
        return len(results.get("ids", []))
    except Exception:
        return 0


def generate_grounded_answer_fallback(question: str, citations: List[Dict[str, Any]]) -> str:
    """
    Deterministic synthesis fallback when outside LLM is unreachable or in sandboxed mode.
    Constructs a grounded, strictly cited summary from the top source chunks.
    """
    if not citations:
        return "Insufficient evidence in uploaded documents."

    snippets = []
    for c in citations[:3]:
        fn = c["filename"]
        pg = c["page"]
        text_snippet = c["excerpt"].replace("\n", " ").strip()
        if len(text_snippet) > 180:
            text_snippet = text_snippet[:177] + "..."
        snippets.append(f"- {text_snippet} [{fn}, Page {pg}]")

    return (
        f"According to SmartCorp policy documentation:\n\n"
        + "\n\n".join(snippets)
    )


def ask_knowledge_base(question: str, org_id: int) -> Dict[str, Any]:
    """
    Query ChromaDB for top 4 chunks with strict where={"org_id": org_id} filter.
    If no relevant chunks are found (or distance is above threshold), return
    "Insufficient evidence in uploaded documents." with empty citations.
    Otherwise, call gemini-2.5-flash with a strict grounding prompt instructing
    it to answer ONLY from the supplied context and cite inline as [Filename, Page X].
    Return {"answer": ..., "citations": [{"id": ..., "filename": ..., "page": ..., "excerpt": ...]}.
    """
    clean_question = question.strip()
    if not clean_question:
        return {
            "answer": "Please ask a specific question regarding company policies.",
            "citations": [],
        }

    # Query ChromaDB with strict tenant isolation
    try:
        results = collection.query(
            query_texts=[clean_question],
            n_results=4,
            where={"org_id": int(org_id)},
        )
    except Exception as e:
        print(f"ChromaDB query error: {e}")
        return {
            "answer": "Insufficient evidence in uploaded documents.",
            "citations": [],
        }

    docs = results.get("documents", [[]])[0] if results else []
    metas = results.get("metadatas", [[]])[0] if results else []
    ids = results.get("ids", [[]])[0] if results else []
    distances = results.get("distances", [[]])[0] if results else []

    if not docs:
        return {
            "answer": "Insufficient evidence in uploaded documents.",
            "citations": [],
        }

    # Distance check: with cosine distance (0=identical, 1=orthogonal, 2=opposite)
    # Cosine distance > 0.85 means unrelated
    if distances and distances[0] > 0.85:
        return {
            "answer": "Insufficient evidence in uploaded documents.",
            "citations": [],
        }

    # Build citations list
    citations: List[Dict[str, Any]] = []
    context_chunks = []
    for doc_id, meta, doc_text in zip(ids, metas, docs):
        fn = meta.get("filename", "Unknown")
        pg = meta.get("page", 1)
        citations.append({
            "id": doc_id,
            "filename": fn,
            "page": pg,
            "excerpt": doc_text,
        })
        context_chunks.append(f"--- Document: {fn} (Page {pg}) ---\n{doc_text}")

    context_str = "\n\n".join(context_chunks)

    # Grounding prompt for Gemini
    system_prompt = (
        "You are the SmartCorp AI Enterprise Grounded Knowledge Assistant. "
        "Your task is to answer employee questions strictly and faithfully using ONLY the provided excerpts from official company policies.\n\n"
        "Rules:\n"
        "1. Answer ONLY using the facts present in the excerpts below.\n"
        "2. If the excerpts do not contain sufficient evidence to answer the question, respond with EXACTLY:\n"
        "'Insufficient evidence in uploaded documents.'\n"
        "3. Every factual claim MUST be followed by an inline citation formatted exactly as [Filename, Page X] (for example: [HR_Leave_Policy.pdf, Page 1]).\n"
        "4. Keep your answer crisp, professional, and structured with concise bullet points where appropriate.\n"
        "5. Do NOT speculate, generalize, or import outside policies not present in the excerpts.\n\n"
        f"Context Excerpts:\n{context_str}\n\n"
        f"Employee Question: {clean_question}\n\n"
        "Grounded Answer:"
    )

    # Call gemini-2.5-flash (or gemini-2.0-flash) with fast timeout, falling back gracefully if unavailable
    answer_text = None
    active_gemini_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY

    if active_gemini_key:
        try:
            try:
                genai.configure(api_key=active_gemini_key, transport="rest")
            except Exception:
                genai.configure(api_key=active_gemini_key)

            try:
                model = genai.GenerativeModel("gemini-2.5-flash")
                response = model.generate_content(
                    system_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=800,
                    ),
                    request_options={"timeout": 6},
                )
                if response and response.text:
                    answer_text = response.text.strip()
            except Exception as e_25:
                print(f"Gemini gemini-2.5-flash unavailable ({e_25}), trying gemini-2.0-flash...")
                model = genai.GenerativeModel("gemini-2.0-flash")
                response = model.generate_content(
                    system_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=800,
                    ),
                    request_options={"timeout": 6},
                )
                if response and response.text:
                    answer_text = response.text.strip()
        except Exception as e:
            # If unavailable, fallback gracefully
            print(f"Gemini response unavailable: {e}")

    if not answer_text:
        # Fallback to deterministic grounded answer
        answer_text = generate_grounded_answer_fallback(clean_question, citations)

    # If answer says insufficient evidence, clear citations
    if "Insufficient evidence in uploaded documents." in answer_text:
        return {
            "answer": "Insufficient evidence in uploaded documents.",
            "citations": [],
        }

    return {
        "answer": answer_text,
        "citations": citations,
    }
