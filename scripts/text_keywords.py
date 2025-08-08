#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import sys
import re

try:
    import advertools as adv
    ADV_OK = True
except Exception as e:
    ADV_OK = False

def clean_text(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Missing input"}))
        sys.exit(1)
    try:
        data = json.loads(sys.argv[1])
        text = clean_text(data.get("text", ""))
        lang = data.get("language", "en")
        top_n = int(data.get("top_n", 12))

        if not text:
            print(json.dumps({"success": True, "dominant_phrases": []}, ensure_ascii=False))
            return

        if not ADV_OK:
            # פולבק אם אין advertools מותקן
            words = [w for w in re.findall(r"[A-Za-z\u0590-\u05FF\-]+", text.lower()) if len(w) > 2]
            # אופציה בסיסית: גזור n-grams 2–4 עם ספירה
            from collections import Counter
            def ngrams(words, n):
                return [" ".join(words[i:i+n]) for i in range(len(words)-n+1)]
            bag = []
            for n in (2, 3, 4):
                bag.extend(ngrams(words, n))
            cnt = Counter(bag)
            top = [{"phrase": p, "count": c} for p, c in cnt.most_common(top_n)]
            print(json.dumps({"success": True, "dominant_phrases": top}, ensure_ascii=False))
            return

        # עם advertools: משתמשים ב-extract_ngrams
        texts = [text]
        dom = []
        for n in (2, 3, 4):
            ng = adv.extract_ngrams(texts, n=n, lang=lang)
            vc = ng[f"{'bi' if n==2 else 'tri' if n==3 else 'four'}gram"].value_counts()
            for phrase, count in vc.head(top_n).items():
                phrase = str(phrase).strip()
                if len(phrase.split()) >= 2:
                    dom.append({"phrase": phrase, "count": int(count)})

        # נרמל, נסיר כפולים, נגביל לאורך
        seen = set()
        out = []
        for item in dom:
            p = item["phrase"].lower()
            p = re.sub(r"\s+", " ", p)
            if p in seen:
                continue
            seen.add(p)
            out.append({"phrase": p, "count": item["count"]})
            if len(out) >= top_n:
                break

        print(json.dumps({"success": True, "dominant_phrases": out}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
