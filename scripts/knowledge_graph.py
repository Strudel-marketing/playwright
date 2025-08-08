#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import sys
import os
import re
from collections import Counter
import requests

# ---- advertools optional ----
try:
    import advertools as adv
    ADVTOOLS_OK = True
except Exception:
    ADVTOOLS_OK = False

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
SCHOLARLY_QID = "Q13442814"  # מאמר אקדמי

STOP_GENERAL = set("""
scientific article published study paper report overview introduction conclusion
january february march april may june july august september october november december
the and or but in on at to for of with by a an is are was were be been have has had
this that these those from into over under out up down as if then else than very more most
less least same such per via within without
""".split())

def is_qid(s: str) -> bool:
    return bool(re.fullmatch(r"Q\d+", str(s).strip(), flags=re.I))

def clean_ngram(s: str) -> str:
    s = re.sub(r"[^A-Za-z\u0590-\u05FF\s-]", " ", str(s).lower()).strip()
    s = re.sub(r"\s+", " ", s)
    return s

def build_ngrams(words, n_low=2, n_high=4):
    out = []
    for n in range(n_low, n_high + 1):
        for i in range(0, max(0, len(words) - n + 1)):
            out.append(" ".join(words[i:i+n]))
    return out

def filter_terms(terms, max_items=10):
    seen = set()
    res = []
    for t in terms:
        t = clean_ngram(t)
        if not t or is_qid(t) or t in STOP_GENERAL:
            continue
        w = t.split()
        if len(w) < 2 or len(w) > 4:
            continue
        if t in seen:
            continue
        seen.add(t)
        res.append(t)
        if len(res) >= max_items:
            break
    return res

def wikidata_search(query: str, language: str = "en", limit: int = 10):
    """חיפוש ישיר בויקידאטה (wbsearchentities)"""
    params = {
        "action": "wbsearchentities",
        "search": query,
        "language": language,
        "uselang": language,
        "format": "json",
        "type": "item",
        "limit": limit,
    }
    r = requests.get(WIKIDATA_API, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    out = []
    for item in data.get("search", []):
        out.append({
            "id": item.get("id"),
            "name": item.get("label"),
            "description": item.get("description"),
            "url": item.get("url") or None,   # לפעמים קיים כבר כאן
            "types": [],                      # נמלא בהמשך
            "source": "wikidata",
        })
    return out

def wikidata_get_entities(qids, language="en"):
    """מביא sitelinks/description בקול אחד עבור רשימת QIDs"""
    qids = [q for q in qids if is_qid(q)]
    if not qids:
        return {}

    params = {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "sitelinks|descriptions|claims",
        "languages": language,
        "format": "json",
    }
    r = requests.get(WIKIDATA_API, params=params, timeout=20)
    r.raise_for_status()
    data = r.json().get("entities", {})
    out = {}
    for qid, ent in data.items():
        sitelinks = ent.get("sitelinks", {}) or {}
        # URL של ויקיפדיה בשפה הרצויה -> אנגלית -> fallback ל־Wikidata
        url = (sitelinks.get(f"{language}wiki", {}) or {}).get("url") \
              or (sitelinks.get("enwiki", {}) or {}).get("url") \
              or f"https://www.wikidata.org/wiki/{qid}"

        # טיפוסים בסיסי: P31 (instance of)
        types = []
        claims = ent.get("claims", {})
        p31 = claims.get("P31", [])
        for claim in p31:
            try:
                typ = claim["mainsnak"]["datavalue"]["value"]["id"]
                if typ:
                    types.append(typ)
            except Exception:
                pass

        desc = ent.get("descriptions", {}).get(language, {}) or ent.get("descriptions", {}).get("en", {})
        description = (desc or {}).get("value")

        out[qid] = {"url": url, "types": types, "description": description}
    return out

def advertools_google_kg(queries, key):
    """עטיפה ל־Advertools KG: מחזיר name/description/types/id/url"""
    results = []
    for q in queries:
        try:
            kg = adv.knowledge_graph(q, key=key)
        except Exception:
            results.append({"query": q, "items": []})
            continue
        items = kg.get("itemListElement") or []
        bundle = []
        for it in items:
            res = (it or {}).get("result") or {}
            google_id = res.get("@id")
            name = res.get("name")
            desc = res.get("description")
            url = None
            # לפעמים detailedDescription קיים
            dd = res.get("detailedDescription") or {}
            if isinstance(dd, dict):
                url = dd.get("url") or None
                desc = dd.get("articleBody") or desc
            types = res.get("@type") or []
            bundle.append({
                "id": google_id,
                "name": name,
                "description": desc,
                "url": url,
                "types": types,
                "source": "google"
            })
        results.append({"query": q, "items": bundle})
    return results

def enhanced_knowledge_graph(data):
    keywords = data.get('keywords', []) or []
    language = data.get('language', 'en')
    include_wikidata = data.get('includeWikidata', True)

    result = {
        "success": True,
        "language": language,
        "used_advertools": ADVTOOLS_OK,
        "queries": keywords,
        "entities": [],
        "google": [],
        "wikidata": [],
        "related_terms": [],
        "semantic_keywords": []
    }

    try:
        if not keywords:
            result["success"] = False
            result["error"] = "No keywords provided"
            return result

        # 1) Google KG via advertools (רק אם מותקן ויש מפתח)
        google_api_key = os.getenv('GOOGLE_API_KEY')
        if ADVTOOLS_OK and google_api_key:
            result["google"] = advertools_google_kg(keywords, google_api_key)
        else:
            result["google"] = []

        # 2) Wikidata: חיפוש לפי מילות מפתח
        wikidata_blocks = []
        if include_wikidata:
            for q in keywords:
                items = wikidata_search(q, language=language, limit=5)
                wikidata_blocks.append({"query": q, "searchItems": items, "sparqlItems": []})
        result["wikidata"] = wikidata_blocks

        # 3) איחוד ישויות + העשרת sitelinks
        qids = []
        for blk in wikidata_blocks:
            for it in blk.get("searchItems", []):
                if is_qid(it.get("id", "")):
                    qids.append(it["id"])
        qids = list(dict.fromkeys(qids))  # ייחוד, שומר סדר

        qid_map = wikidata_get_entities(qids, language=language) if qids else {}

        entities = []
        for blk in wikidata_blocks:
            for it in blk.get("searchItems", []):
                ent = {
                    "id": it.get("id"),
                    "name": it.get("name"),
                    "description": it.get("description"),
                    "url": it.get("url"),
                    "types": [],
                    "source": "wikidata"
                }
                if ent["id"] in qid_map:
                    enr = qid_map[ent["id"]]
                    ent["url"] = ent["url"] or enr.get("url")
                    ent["types"] = enr.get("types") or []
                    if not ent.get("description"):
                        ent["description"] = enr.get("description")
                entities.append(ent)

        result["entities"] = entities

        # 4) בניית related/semantic נקיים
        bag = []
        for ent in entities:
            if SCHOLARLY_QID in (ent.get("types") or []):
                continue
            desc = ent.get("description") or ""
            text = clean_ngram(desc)
            words = [w for w in text.split() if w not in STOP_GENERAL and len(w) > 2]
            bag.extend(build_ngrams(words, 2, 3))  # 2–3 מילים
        cnt = Counter(bag)
        related_terms = [t for t, _ in cnt.most_common(30)]
        related_terms = filter_terms(related_terms, max_items=10)

        sem_bag = []
        for ent in entities:
            name = ent.get("name")
            if name:
                sem_bag.append(clean_ngram(name))
            desc = ent.get("description") or ""
            text = clean_ngram(desc)
            words = [w for w in text.split() if w not in STOP_GENERAL and len(w) > 2]
            sem_bag.extend(build_ngrams(words, 2, 4))
        cnt2 = Counter(sem_bag)
        semantic_keywords = [t for t, _ in cnt2.most_common(50)]
        semantic_keywords = filter_terms(semantic_keywords, max_items=15)

        result["related_terms"] = related_terms
        result["semantic_keywords"] = semantic_keywords

        return result

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "debug_info": {
                "keywords_count": len(keywords),
                "has_api_key": bool(os.getenv('GOOGLE_API_KEY')),
                "advtools_ok": ADVTOOLS_OK
            }
        }

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Missing input data argument"}, ensure_ascii=False))
        sys.exit(1)
    try:
        data = json.loads(sys.argv[1])
        out = enhanced_knowledge_graph(data)
        print(json.dumps(out, ensure_ascii=False))
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON input: {str(e)}"}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Unexpected error: {str(e)}"}, ensure_ascii=False))
