#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys, json, re, time
from collections import Counter
from typing import List, Dict

# ===== Optional Advertools =====
try:
    import advertools as adv
    HAS_ADVERTOOLS = True
except Exception:
    HAS_ADVERTOOLS = False

# ===== Requests & SPARQL =====
try:
    import requests
except Exception:
    raise SystemExit("This script requires 'requests'. Install: pip install requests")
try:
    from SPARQLWrapper import SPARQLWrapper, JSON
    HAS_SPARQL = True
except Exception:
    HAS_SPARQL = False

GOOGLE_KG_ENDPOINT = "https://kgsearch.googleapis.com/v1/entities:search"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# -------------------- Utilities --------------------
def _clean(s: str) -> str:
    if not s:
        return s
    return re.sub(r"\s+", " ", str(s)).strip()

def _iterable(obj):
    try:
        iter(obj)
        return True
    except Exception:
        return False

def _unique(seq):
    seen = set()
    out = []
    for x in seq:
        key = json.dumps(x, sort_keys=True, ensure_ascii=False)
        if key not in seen:
            seen.add(key)
            out.append(x)
    return out

# -------------------- Google KG --------------------
def fetch_google_kg_http(query: str, language: str, key: str, limit: int = 5) -> List[Dict]:
    if not key:
        return []
    params = {"query": query, "key": key, "limit": limit, "languages": language}
    r = requests.get(GOOGLE_KG_ENDPOINT, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    items = []
    for el in data.get("itemListElement", []):
        res = el.get("result", {}) or {}
        items.append({
            "name": res.get("name"),
            "description": res.get("description"),
            "types": res.get("@type") or [],
            "score": el.get("resultScore"),
            "google_kg_id": res.get("@id"),
            "url": (res.get("detailedDescription") or {}).get("url") or res.get("url"),
            "detailedDescription": (res.get("detailedDescription") or {}).get("articleBody"),
            "image": (res.get("image") or {}).get("contentUrl"),
            "source": "google"
        })
    return items

def fetch_google_kg_advertools(query: str, language: str, key: str, limit: int = 5) -> List[Dict]:
    """
    מנסה להריץ advertools. אם החתימה שונה/נכשל — נופל ל-HTTP.
    """
    if not HAS_ADVERTOOLS:
        return fetch_google_kg_http(query, language, key, limit)
    try:
        # נסה כמה חתימות נפוצות בין גרסאות:
        df = None
        for call in (
            lambda: adv.knowledge_graph(query=query, api_key=key, languages=[language], limit=limit),
            lambda: adv.knowledge_graph(query=query, key=key, languages=[language], limit=limit),
            lambda: adv.knowledge_graph(query=query, auth=key, languages=[language], limit=limit),
            lambda: adv.knowledge_graph(query=query, api_key=key, language=language, limit=limit),
        ):
            try:
                df = call()
                break
            except Exception:
                continue
        if df is None:
            raise RuntimeError("advertools.knowledge_graph signature mismatch")

        items = []
        # DataFrame → rows
        if hasattr(df, "iterrows"):
            for _, row in df.iterrows():
                types = row.get("@type")
                if types and not isinstance(types, list):
                    types = [types]
                items.append({
                    "name": row.get("name"),
                    "description": row.get("description"),
                    "types": types or [],
                    "score": row.get("_score") or row.get("resultScore"),
                    "google_kg_id": row.get("@id") or row.get("id"),
                    "url": row.get("detailedDescription.url") or row.get("url"),
                    "detailedDescription": row.get("detailedDescription.articleBody") or row.get("detailedDescription"),
                    "image": row.get("image.contentUrl") or row.get("image"),
                    "source": "google"
                })
            return items

        # אחרת ננסה כ-JSON
        try:
            data = df if isinstance(df, dict) else json.loads(df)
            if isinstance(data, dict):
                return fetch_google_kg_http(query, language, key, limit) if "itemListElement" not in data else [
                    {
                        "name": (el.get("result") or {}).get("name"),
                        "description": (el.get("result") or {}).get("description"),
                        "types": (el.get("result") or {}).get("@type") or [],
                        "score": el.get("resultScore"),
                        "google_kg_id": (el.get("result") or {}).get("@id"),
                        "url": ((el.get("result") or {}).get("detailedDescription") or {}).get("url") or (el.get("result") or {}).get("url"),
                        "detailedDescription": ((el.get("result") or {}).get("detailedDescription") or {}).get("articleBody"),
                        "image": ((el.get("result") or {}).get("image") or {}).get("contentUrl"),
                        "source": "google"
                    }
                    for el in data.get("itemListElement", [])
                ]
        except Exception:
            pass

        # fallback סופי
        return fetch_google_kg_http(query, language, key, limit)
    except Exception:
        return fetch_google_kg_http(query, language, key, limit)

def fetch_google_kg_batch(queries: List[str], language: str, key: str, limit: int = 5) -> List[Dict]:
    out = []
    for q in queries:
        q = _clean(q)
        if not q:
            continue
        items = fetch_google_kg_advertools(q, language, key, limit)
        out.append({"query": q, "items": items})
        # דיליי קטן למניעת rate limit
        time.sleep(0.1)
    return out

# -------------------- Wikidata --------------------
def wikidata_search(query: str, language: str, limit: int = 5) -> List[str]:
    params = {
        "action": "wbsearchentities",
        "search": query,
        "language": language,
        "limit": str(limit),
        "format": "json",
    }
    r = requests.get(WIKIDATA_API, params=params, timeout=15, headers={"user-agent": "seo-audit/1.0"})
    r.raise_for_status()
    data = r.json()
    return [s["id"] for s in data.get("search", [])]

def wikidata_get_entities(ids: List[str], language: str) -> List[Dict]:
    if not ids:
        return []
    params = {
        "action": "wbgetentities",
        "ids": "|".join(ids),
        "languages": language,
        "format": "json",
        "props": "labels|descriptions|sitelinks|claims",
    }
    r = requests.get(WIKIDATA_API, params=params, timeout=20, headers={"user-agent": "seo-audit/1.0"})
    r.raise_for_status()
    ejson = r.json().get("entities", {})
    out = []
    for eid, ent in ejson.items():
        label = ent.get("labels", {}).get(language, {}).get("value") or ent.get("labels", {}).get("en", {}).get("value")
        desc  = ent.get("descriptions", {}).get(language, {}).get("value") or ent.get("descriptions", {}).get("en", {}).get("value")
        sitelinks = ent.get("sitelinks", {})
        url = (sitelinks.get(f"{language}wiki", {}) or {}).get("url") or (sitelinks.get("enwiki", {}) or {}).get("url")
        types = []
        for cl in ent.get("claims", {}).get("P31", []) or []:
            try:
                types.append(cl["mainsnak"]["datavalue"]["value"]["id"])
            except Exception:
                pass
        out.append({
            "id": eid, "name": _clean(label), "description": _clean(desc),
            "url": url, "types": types, "source": "wikidata"
        })
    return out

def wikidata_sparql(query: str, language: str, limit: int = 10) -> List[Dict]:
    if not HAS_SPARQL:
        return []
    sparql = SPARQLWrapper(WIKIDATA_SPARQL, agent="seo-audit/1.0")
    # חיפוש גם ב-label וגם ב-altLabel ובשפה שביקשת + fallback ל-en
    q = f"""
    SELECT ?item ?itemLabel ?description ?instanceLabel WHERE {{
      VALUES ?lang {{ "{language}" "en" }}
      ?item ?lbl "{query}"@{language}.
      VALUES ?lbl {{ rdfs:label skos:altLabel }}
      OPTIONAL {{ ?item schema:description ?description FILTER(LANG(?description)=?lang) }}
      OPTIONAL {{
        ?item wdt:P31 ?instance .
        ?instance rdfs:label ?instanceLabel FILTER(LANG(?instanceLabel)=?lang)
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{language},en". }}
    }}
    LIMIT {limit}
    """
    sparql.setQuery(q)
    sparql.setReturnFormat(JSON)
    res = sparql.query().convert()
    rows = res.get("results", {}).get("bindings", []) or []
    out = []
    for b in rows:
        uri = b.get("item", {}).get("value", "")
        qid = uri.split("/")[-1] if uri else None
        out.append({
            "id": qid,
            "name": _clean(b.get("itemLabel", {}).get("value")),
            "description": _clean(b.get("description", {}).get("value")),
            "types": [_clean(b.get("instanceLabel", {}).get("value"))] if b.get("instanceLabel") else [],
            "source": "wikidata_sparql"
        })
    return out

def fetch_wikidata_batch(queries: List[str], language: str, limit: int = 5) -> List[Dict]:
    out = []
    for q in queries:
        q = _clean(q)
        if not q:
            continue
        try:
            ids = wikidata_search(q, language, limit)
            ents = wikidata_get_entities(ids, language)
            sparql_items = wikidata_sparql(q, language, limit=10) if HAS_SPARQL else []
            out.append({"query": q, "searchItems": ents, "sparqlItems": sparql_items})
        except Exception as e:
            out.append({"query": q, "error": str(e), "searchItems": [], "sparqlItems": []})
        time.sleep(0.1)
    return out

# -------------------- Terms Extraction --------------------
STOP_WORDS = set("""
the and or but in on at to for of with by a an is are was were be been have has had do does did will would should could can may might
this that these those from into over under out up down not as if then else than very more most less least same such per via within without
של את עם על אל כל לא אם כי זה היא הוא אצל בין גם רק כמו להיות היה יהיו יש אין או וגם אך לכן כדי בגלל תוך לפי
""".split())

def tokenize(text: str) -> List[str]:
    text = _clean(re.sub(r"[^\u0590-\u05FFA-Za-z0-9\s\-]", " ", text or "").lower())
    return [w for w in text.split() if len(w) > 2 and w not in STOP_WORDS and not w.isdigit()]

def ngrams(tokens: List[str], n: int) -> List[str]:
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens)-n+1)]

def build_related_terms(entities: List[Dict], topn: int = 10) -> List[str]:
    bag = []
    for e in entities:
        for field in ("description", "detailedDescription"):
            bag.extend(tokenize(e.get(field, "")))
    return [w for w, _ in Counter(bag).most_common(topn)]

def build_semantic_keywords(entities: List[Dict], topn: int = 15) -> List[str]:
    bag = []
    for e in entities:
        # סוגים (types) חשובים
        for t in e.get("types") or []:
            if isinstance(t, str):
                bag.extend(tokenize(t))
        # n-grams מהתיאור
        desc_tokens = tokenize(e.get("description", "") + " " + e.get("detailedDescription", "") if e.get("detailedDescription") else e.get("description", ""))
        for n in (2, 3):
            bag.extend(ngrams(desc_tokens, n))
    counted = Counter(bag).most_common(topn)
    return [p for p, _ in counted]

# -------------------- Main Entrypoint --------------------
def enhanced_knowledge_graph(data):
    keywords = data.get('keywords', []) or []
    language = data.get('language', 'en')
    include_wikidata = bool(data.get('includeWikidata', True))
    limit = int(data.get('limit', 5))

    # ודא שהמפתחות שלנו strings
    queries = []
    for k in keywords:
        if not k:
            continue
        if _iterable(k) and not isinstance(k, (str, bytes)):
            k = " ".join(str(x) for x in k if x)
        queries.append(_clean(str(k)))
    queries = [q for q in queries if q]

    out = {
        "success": True,
        "language": language,
        "used_advertools": HAS_ADVERTOOLS,
        "queries": queries,
        "entities": [],
        "google": [],
        "wikidata": [],
        "related_terms": [],
        "semantic_keywords": []
    }

    try:
        google_key = os.getenv("GOOGLE_API_KEY") or ""
        # Google KG
        gblocks = fetch_google_kg_batch(queries, language, google_key, limit)
        out["google"] = gblocks

        # פריסת entities מאוחדים
        g_entities = []
        for blk in gblocks:
            g_entities.extend(blk.get("items", []))

        # Wikidata
        wd_blocks = []
        if include_wikidata:
            wd_blocks = fetch_wikidata_batch(queries, language, limit)
            out["wikidata"] = wd_blocks
        wd_entities = []
        for blk in wd_blocks:
            wd_entities.extend(blk.get("searchItems", []))
            wd_entities.extend(blk.get("sparqlItems", []))

        # איחוד בסיסי (לפי name+url או לפי id)
        merged = _unique([
            e for e in (g_entities + wd_entities) if e.get("name") or e.get("id") or e.get("google_kg_id")
        ])

        out["entities"] = merged
        out["related_terms"] = build_related_terms(merged)
        out["semantic_keywords"] = build_semantic_keywords(merged)

        return out
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "debug_info": {
                "queries": queries,
                "has_api_key": bool(os.getenv("GOOGLE_API_KEY")),
                "used_advertools": HAS_ADVERTOOLS,
            }
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Missing input data argument"}))
        sys.exit(1)
    try:
        data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON input: {e}"}))
        sys.exit(1)
    result = enhanced_knowledge_graph(data)
    print(json.dumps(result, ensure_ascii=False))
