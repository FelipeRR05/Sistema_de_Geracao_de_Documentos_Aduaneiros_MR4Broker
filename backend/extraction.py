import os
import json
import base64
import httpx
import fitz
import re
import pandas as pd
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
from schemas import ExtractionResult

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
VISION_MODEL = os.getenv("VISION_MODEL", "llava")

def load_aliases() -> str:
    try:
        from database import SessionLocal, ExtractionAlias
        db = SessionLocal()
        aliases = db.query(ExtractionAlias).all()
        data = {a.campo_sistema: [x.strip() for x in a.aliases.split(',')] for a in aliases}
        db.close()
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return "{}"

def repair_json(raw_text: str) -> str:
    text = re.sub(r'```(?:json)?\s*', '', raw_text)
    text = re.sub(r'\s*```', '', text).strip()
    if not text.startswith('{'):
        start_idx = text.find('{')
        text = text[start_idx:] if start_idx != -1 else '{' + text
    if not text.endswith('}'):
        end_idx = text.rfind('}')
        text = text[:end_idx+1] if end_idx != -1 else text + '}'
    return text

async def call_ollama(prompt: str, images: list = None) -> Dict[str, Any]:
    payload = {
        "model": VISION_MODEL if images else OLLAMA_MODEL,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "keep_alive": 0,
        "options": {"temperature": 0, "num_ctx": 8192}
    }
    if images: payload["images"] = images
    try:
        async with httpx.AsyncClient(timeout=150.0) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
            repaired = repair_json(response.json().get("response", "{}"))
            return json.loads(repaired)
    except Exception: return {}

def is_hallucinated_fill(val: Any) -> bool:
    if not isinstance(val, str): return False
    return bool(re.search(r'(.)\1{9,}', val))

def sanitize_to_float(val: Any) -> Optional[float]:
    if val is None or is_hallucinated_fill(val): return None
    s_val = str(val).lower().replace('kg', '').replace('lbs', '').replace(',', '.').strip()
    clean_val = re.sub(r'[^\d.]', '', s_val)
    try: return float(clean_val)
    except ValueError: return None

async def extract_data(file_path: str) -> Dict[str, Any]:
    ext = os.path.splitext(file_path)[1].lower()
    content, images = "", []
    if ext == ".pdf":
        doc = fitz.open(file_path)
        content = "\n".join([p.get_text() for p in doc])
        content = re.sub(r'[ \t]+', ' ', content)
        if len(content.strip()) < 100:
            for i in range(min(len(doc), 2)):
                pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                images.append(base64.b64encode(pix.tobytes("png")).decode("utf-8"))
            content = "Scanned document logic triggered."
    elif ext in [".xls", ".xlsx"]:
        content = pd.read_excel(file_path).to_string()
    
    alias_json = load_aliases()
    alias_dict = json.loads(alias_json)
    schema_keys = list(alias_dict.keys())
    
    prompt = f"""
    SYSTEM: You are a high-precision customs data extractor for MR4Broker.
    Use these keys: {schema_keys}.
    
    ALIAS TABLE (System Key -> Common Names in Documents):
    {alias_json}
    
    CRITICAL RULES:
    1. GEOGRAPHIC: 'country_of_origin' must be ONLY the country name. If 'Port of Santos, Brazil', use 'Brazil'.
    2. CONTAINER: 'container_number' must be the 11-character ID (e.g. MSCU1234567). Ignore quantities like '1x40'.
    3. ADDRESSES: PRESERVE FULL ADDRESS BLOCKS with line breaks for 'shipper', 'consignee', and 'notify_party'. 
       Do not flatten the address into a single line. Keep the structure found in the document.
    4. NCM: Extract ONLY the numeric code.
    
    Content: {content[:4000]}
    """
    
    raw_data = await call_ollama(prompt, images)
    
    sanitized, log = {}, {}
    for k in schema_keys:
        val = raw_data.get(k)
        if is_hallucinated_fill(val): val = None
        
        if k in ['gross_weight', 'net_weight']:
            sanitized[k] = sanitize_to_float(val)
        else:
            sanitized[k] = val

    sanitized["internal_log"] = log
    return sanitized

async def compare_files(file1_path: str, file2_path: str) -> Dict[str, Any]:
    def get_content(file_path):
        ext = os.path.splitext(file_path)[1].lower()
        content = ""
        images = []
        if ext == ".pdf":
            doc = fitz.open(file_path)
            content = "\n".join([p.get_text() for p in doc])
            content = re.sub(r'[ \t]+', ' ', content)
            if len(content.strip()) < 100:
                for i in range(min(len(doc), 2)):
                    pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                    images.append(base64.b64encode(pix.tobytes("png")).decode("utf-8"))
                content = "Scanned document logic triggered."
        elif ext in [".xls", ".xlsx"]:
            content = pd.read_excel(file_path).to_string()
        return content, images

    content1, images1 = get_content(file1_path)
    content2, images2 = get_content(file2_path)
    
    import asyncio
    
    async def extract_single(content: str, images: list, doc_type: str) -> Dict[str, Any]:
        prompt = f"""
        SYSTEM: You are a highly accurate data extractor for customs documents.
        You will be provided with a single document ({doc_type}).
        
        TASK: Read the DOCUMENT and extract its data. If a piece of information is missing or not explicitly mentioned, you MUST write "Not mentioned". DO NOT guess.
        
        CRITICAL RULES AND OCR CORRECTIONS:
        1. MULTILINE ADDRESSES: For 'Shipper', 'Consignee', and 'Notify Party', extract the FULL address block (all lines). Do not flatten.
        2. CONTAINER NUMBER: Extract ONLY the alphanumeric code (e.g., "XXXU1234567").
        3. WEIGHTS vs MEASUREMENT (OCR FIX): 
           - In some Invoices, the numeric values for weights (e.g., 28.400,000 and 28.440,000) are separated from the "NET WEIGHT: KGS" and "GROSS WEIGHT: KGS" labels and pushed to the very bottom of the document text. You MUST look at the end of the text to find the actual numbers and combine them with "KGS". Do not just extract "KGS".
           - "Measurement" or "Cubic" is usually in M3 or CBM.
        4. PORTS & LOCATIONS (OCR FIX): 
           - Due to column layouts, you might see "Place of Receipt Port of Loading \n ITAPOA ( BRIOA) - Brasil". Here, Port of Loading is "ITAPOA (BRIOA) - Brasil".
           - You might see "Port of Discharge Place of Delivery \n HOUSTON, TX". Here, Port of Discharge is "HOUSTON, TX..." and Place of Delivery is "Not mentioned" (if empty). Do NOT invert Port of Loading and Port of Discharge.
        5. PLACE OF DELIVERY: Do not extract unrelated terms like 'P.O 4708' as Place of Delivery.
        6. Do NOT hallucinate data not present in the document.
        
        --- DOCUMENT ({doc_type}) START ---
        {content[:12000]}
        --- DOCUMENT ({doc_type}) END ---
        
        EXPECTED JSON OUTPUT (Generate EXACTLY this structure):
        {{
            "Shipper": "...", "Consignee": "...", "Notify Party": "...", "Vessel / Voyage": "...", "Port of Loading": "...", "Port of Discharge": "...", "Place of Delivery": "...", "Container Number": "...", "Seal Number": "...", "Number of Packages": "...", "Description of Goods": "...", "Marks": "...", "Gross Weight": "...", "Net Weight": "...", "Measurement": "...", "NCM / HS Code": "...", "DUE / RUC": "..."
        }}
        """
        return await call_ollama(prompt, images if images else None)

    doc1_data, doc2_data = await asyncio.gather(
        extract_single(content1, images1, "INVOICE"),
        extract_single(content2, images2, "DRAFT BL")
    )
    
    compare_prompt = f"""
    SYSTEM: You are a customs data comparator. Compare the data extracted from two documents and generate a JSON report.
    
    DATA FROM DOCUMENT 1 (INVOICE):
    {json.dumps(doc1_data, ensure_ascii=False)}
    
    DATA FROM DOCUMENT 2 (DRAFT BL):
    {json.dumps(doc2_data, ensure_ascii=False)}
    
    CRITICAL RULES:
    1. Compare each field strictly to determine the 'status':
       - Use "idêntico" se os valores forem perfeitamente iguais (ignorando apenas espaços extras).
       - Use "parecido" se os valores forem logicamente os mesmos mas com formatos diferentes, ausência de pontuação, pequenas abreviações ou diferenças na forma de apresentar (ex: "Itapoa, Brazil" vs "ITAPOA (BRIOA) - Brasil", ou blocos de endereço com leves variações).
       - Use "divergente" se houver uma diferença real de valor (ex: pesos diferentes, portos diferentes) ou se um estiver "Not mentioned" enquanto o outro tem valor.
    2. Write 'description' and 'general_observations' in Portuguese (PT-BR). Seja sincero e explique claramente por que é divergente ou parecido.
    3. Do NOT modify the original doc1_value and doc2_value. Keep them exactly as provided.
    
    EXPECTED JSON OUTPUT (Generate EXACTLY this structure):
    {{
        "comparisons": [
            {{"field": "Shipper", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Consignee", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Notify Party", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Vessel / Voyage", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Port of Loading", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Port of Discharge", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Place of Delivery", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Container Number", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Seal Number", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Number of Packages", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Description of Goods", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Marks", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Gross Weight", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Net Weight", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "Measurement", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "NCM / HS Code", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}},
            {{"field": "DUE / RUC", "doc1_value": "...", "doc2_value": "...", "status": "idêntico, parecido ou divergente", "description": "Explicação em português..."}}
        ],
        "general_observations": "Observações gerais em português."
    }}
    """
    
    compare_result = await call_ollama(compare_prompt)
    
    final_result = {
        "extracted_from_doc1": doc1_data,
        "extracted_from_doc2": doc2_data,
        "comparisons": compare_result.get("comparisons", []),
        "general_observations": compare_result.get("general_observations", "")
    }
    
    return final_result
