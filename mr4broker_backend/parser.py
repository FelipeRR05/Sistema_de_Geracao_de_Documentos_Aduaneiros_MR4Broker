import re
import json
import fitz
import pdfplumber
from unstructured.partition.pdf import partition_pdf
from typing import List, Dict

def clean_line(t: str) -> str:
    if not t:
        return ""
    t = t.replace("\t", " ").replace("\xa0", " ")
    t = re.sub(r"\(cid:\d+\)", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def clean_value(t: str) -> str:
    if not t:
        return ""

    s = clean_line(t)

    if s in [":", ".", "-", "_"]:
        return ""

    if ":" in s and not re.search(r"\d", s):
        return ""

    if s.lower() in ["kg", "cbm", "m3", "m³"]:
        return ""

    if len(s) > 300:
        return ""

    return s.strip()


def first_valid(values: List[str]) -> str:
    for v in values:
        c = clean_value(v)
        if c:
            return c
    return "Não Encontrado"


def is_title(line: str, all_titles: List[str]) -> bool:
    low = clean_line(line).lower().replace(":", "").replace("/", "")
    for t in all_titles:
        t2 = t.lower().replace(":", "").replace("/", "").strip()
        if low.startswith(t2):
            return True
    return False


def extract_unstructured(path: str) -> str:
    try:
        els = partition_pdf(filename=path, strategy="fast", include_page_breaks=False)
        return "\n".join([e.text for e in els if e.text])
    except:
        return ""


def extract_plumber(path: str) -> str:
    try:
        out = []
        with pdfplumber.open(path) as pdf:
            for p in pdf.pages:
                txt = p.extract_text()
                if txt:
                    out.append(txt)
        return "\n".join(out)
    except:
        return ""


def extract_pymupdf(path: str) -> str:
    try:
        pdf = fitz.open(path)
        return "\n".join([page.get_text() for page in pdf])
    except:
        return ""

def split_columns(lines_block: List[str]) -> List[str]:
    rows = []
    for ln in lines_block:
        parts = re.split(r"\s{3,}", ln)
        parts = [p.strip() for p in parts if p.strip()]
        if parts:
            rows.append(parts)

    if not rows:
        return []

    max_cols = max(len(r) for r in rows)
    cols = [[] for _ in range(max_cols)]

    for row in rows:
        for idx in range(max_cols):
            if idx < len(row):
                cols[idx].append(row[idx])

    final_cols = [" ".join(c).strip() for c in cols]
    final_cols = [clean_value(c) for c in final_cols if clean_value(c)]

    return final_cols

def extract_port_of_loading_from_text(full_text: str) -> str:
    """
    Captura somente padrões LOCODE (AAA, BB, CC).
    Evita pegar Port of discharge ou clusters.
    """
    pat = r"port of loading[:\s]*([A-Z\s]+,\s*[A-Z]{2},\s*[A-Z]{2})"
    m = re.search(pat, full_text, flags=re.IGNORECASE)
    if m:
        return clean_value(m.group(1))
    return None

def extract_blocks(lines: List[str], alias_data: List[Dict], all_triggers: List[str]) -> Dict[str, List[str]]:
    out = {item["termo"]: [] for item in alias_data}

    trig_map = {}
    for item in alias_data:
        main = item["termo"]
        for a in [main] + item["alias"]:
            key = a.lower().replace(":", "").replace("/", "").strip()
            trig_map[key] = main

    n = len(lines)
    i = 0

    while i < n:
        line = lines[i]
        low = line.lower().replace(":", "").replace("/", "")

        if "consignee" in low and "notify" in low:

            block = []
            j = i + 1
            while j < n and not is_title(lines[j], all_triggers) and len(block) < 10:

                if re.search(r"\bapplic(a|an|ant|cant)\b", lines[j].lower()):
                    j += 1
                    continue

                if lines[j].lower().strip().startswith("aplicant"):
                    j += 1
                    continue

                block.append(lines[j])
                j += 1

            cols = split_columns(block)

            if len(cols) == 1:
                out["Consignee"].append(cols[0])
                out["Notify"].append(cols[0])
            elif len(cols) >= 2:
                out["Consignee"].append(cols[0])
                out["Notify"].append(cols[1])

            i = j
            continue

        matched = None
        for trg in all_triggers:
            if low.startswith(trg):
                matched = trg
                break

        if matched:
            main = trig_map[matched]

            inline = re.sub(rf"^{re.escape(matched)}[:\s]*", "", line, flags=re.I).strip()
            inline = clean_value(inline)

            if inline:
                out[main].append(inline)
                i += 1
                continue

            block = []
            j = i + 1
            while j < n and not is_title(lines[j], all_triggers) and len(block) < 10:
                block.append(lines[j])
                j += 1

            if main == "Consignee":

                clean_block = []
                for ln in block:
                    if re.search(r"\bapplic(a|an|ant|cant)\b", ln.lower()):
                        continue
                    clean_block.append(ln)

                cols = split_columns(clean_block)

                if len(cols) == 1:
                    out["Consignee"].append(cols[0])
                    out["Notify"].append(cols[0])
                elif len(cols) >= 2:
                    out["Consignee"].append(cols[0])
                    out["Notify"].append(cols[1])
                i = j
                continue

            joined = clean_value(" ".join(block))
            if joined:
                out[main].append(joined)

            i = j
            continue

        i += 1

    return out

def extract_regex(full_text: str, alias_data: List[Dict], triggers: List[str]) -> Dict[str, List[str]]:
    out = {item["termo"]: [] for item in alias_data}

    for item in alias_data:
        term = item["termo"]
        for trg in [term] + item["alias"]:
            pat = re.compile(rf"{re.escape(trg)}[:\s]*([^\n]{{1,150}})", re.I)
            m = pat.search(full_text)
            if m:
                val = clean_value(m.group(1))
                if val:
                    out[term].append(val)

    return out

def combine(blocks: Dict[str, List[str]], regex: Dict[str, List[str]]) -> Dict[str, str]:
    final = {}
    for k in blocks:
        final[k] = first_valid(blocks[k] + regex[k])
    return final

def parse_universal_pdf(file_path: str, alias_file: str) -> List[Dict]:
    with open(alias_file, "r", encoding="utf-8") as f:
        alias_data = json.load(f)

    t1 = extract_unstructured(file_path)
    t2 = extract_plumber(file_path)
    t3 = extract_pymupdf(file_path)
    full_text = "\n".join([t1, t2, t3])

    lines = [clean_line(l) for l in full_text.split("\n") if clean_line(l)]

    all_triggers = []
    for item in alias_data:
        for a in [item["termo"]] + item["alias"]:
            all_triggers.append(a.lower().replace(":", "").replace("/", "").strip())

    blocks = extract_blocks(lines, alias_data, all_triggers)
    regex = extract_regex(full_text, alias_data, all_triggers)

    port_load = extract_port_of_loading_from_text(full_text)
    if port_load:
        blocks["Port of Loading"] = [port_load]

    final = combine(blocks, regex)

    if final.get("Notify") == "Não Encontrado" and final.get("Consignee") != "Não Encontrado":
        final["Notify"] = final["Consignee"]

    if final.get("Place of Delivery") == "Não Encontrado" and final.get("Port of Discharge") != "Não Encontrado":
        final["Place of Delivery"] = final["Port of Discharge"]

    return [
        {
            "field_name": k,
            "parsed_value": v,
            "confidence_score": 0.9 if v != "Não Encontrado" else 0.0
        }
        for k, v in final.items()
    ]
