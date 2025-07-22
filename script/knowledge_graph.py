#!/usr/bin/env python3
import json
import sys
import os
import advertools as adv
from SPARQLWrapper import SPARQLWrapper, JSON

def enhanced_knowledge_graph(data):
    keywords = data.get('keywords', [])
    language = data.get('language', 'en')
    include_wikidata = data.get('includeWikidata', True)
    
    results = {
        'success': True,
        'entities': [],
        'related_terms': [],
        'semantic_keywords': []
    }
    
    try:
        # Google Knowledge Graph עם Advertools
        if keywords:
            # 🔒 SECURE: רק מenvironment variable
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if not google_api_key:
                raise ValueError('GOOGLE_API_KEY environment variable is required')
            
            kg_data = adv.knowledge_graph(keywords, key=google_api_key)
            
            for entity in kg_data.get('itemListElement', []):
                result = entity.get('result', {})
                enhanced_entity = {
                    'name': result.get('name', ''),
                    'description': result.get('description', ''),
                    'types': result.get('@type', []),
                    'score': entity.get('resultScore', 0),
                    'google_kg_id': result.get('@id', '')
                }
                
                # הוסף Wikidata אם מבוקש
                if include_wikidata and enhanced_entity['name']:
                    try:
                        wikidata_info = get_wikidata_info(enhanced_entity['name'], language)
                        enhanced_entity['wikidata'] = wikidata_info
                    except Exception as e:
                        enhanced_entity['wikidata'] = {'error': str(e)}
                
                results['entities'].append(enhanced_entity)
        
        # יצירת related terms וסמנטיים
        results['related_terms'] = generate_related_terms(results['entities'])
        results['semantic_keywords'] = generate_semantic_keywords(results['entities'], language)
        
    except Exception as e:
        results = {
            'success': False,
            'error': str(e),
            'debug_info': {
                'keywords_count': len(keywords) if keywords else 0,
                'has_api_key': bool(os.getenv('GOOGLE_API_KEY'))
            }
        }
    
    return results

def get_wikidata_info(entity_name, language='en'):
    """חיפוש מתקדם ב-Wikidata"""
    try:
        sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
        sparql.setUserAgent("PlaywrightKnowledgeGraph/1.0 (https://play.strudel.marketing)")
        
        # SPARQL query מפושט יותר
        query = f"""
        SELECT ?entity ?entityLabel ?description WHERE {{
          ?entity rdfs:label "{entity_name}"@en .
          OPTIONAL {{ ?entity schema:description ?description }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{language},en" }}
        }}
        LIMIT 3
        """
        
        sparql.setQuery(query)
        sparql.setReturnFormat(JSON)
        results = sparql.query().convert()
        
        wikidata_results = []
        for result in results["results"]["bindings"]:
            wikidata_results.append({
                'wikidata_id': result['entity']['value'].split('/')[-1],
                'label': result.get('entityLabel', {}).get('value', ''),
                'description': result.get('description', {}).get('value', '')
            })
        
        return wikidata_results if wikidata_results else [{'info': 'No Wikidata entries found'}]
        
    except Exception as e:
        return [{'error': f'Wikidata query failed: {str(e)}'}]

def generate_related_terms(entities):
    """יצירת מילים קשורות"""
    related = []
    for entity in entities:
        if entity.get('description'):
            # חלץ מילים חשובות מהתיאור
            words = entity['description'].split()
            # סנן מילים קצרות ו-stop words
            filtered_words = [
                w.lower().strip('.,!?') 
                for w in words 
                if len(w) > 4 and w.lower() not in ['the', 'and', 'for', 'with', 'this', 'that', 'from']
            ]
            related.extend(filtered_words)
    
    # החזר top 10 unique terms
    unique_terms = list(set(related))
    return unique_terms[:10]

def generate_semantic_keywords(entities, language='en'):
    """יצירת מילות מפתח סמנטיות"""
    semantic_kw = []
    
    for entity in entities:
        # הוסף entity types
        if entity.get('types'):
            semantic_kw.extend([t.lower() for t in entity['types'] if isinstance(t, str)])
        
        # חלץ מילים מעניינות מהתיאור
        if entity.get('description'):
            desc_words = entity['description'].lower().split()
            # קח רק מילים ארוכות שנראות חשובות
            important_words = [
                w.strip('.,!?') 
                for w in desc_words 
                if len(w) > 3 and not w.isdigit()
            ]
            semantic_kw.extend(important_words)
    
    # נקה duplicates ותחזיר top 15
    unique_keywords = list(set(semantic_kw))
    return unique_keywords[:15]

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Missing input data argument'
        }))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        result = enhanced_knowledge_graph(input_data)
        print(json.dumps(result, ensure_ascii=False))
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }))
