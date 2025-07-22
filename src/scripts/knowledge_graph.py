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
            # השתמש ב-API key מהסביבה או default
            google_api_key = os.getenv('GOOGLE_API_KEY', 'AIzaSyCJrfB3R7HJ50R-MNQkECpZqTrfyE8vsj4')
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
            'error': str(e)
        }
    
    return results

def get_wikidata_info(entity_name, language='en'):
    """חיפוש מתקדם ב-Wikidata"""
    try:
        sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
        
        # SPARQL query מפושט
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
        
        return wikidata_results
        
    except Exception as e:
        return [{'error': str(e)}]

def generate_related_terms(entities):
    """יצירת מילים קשורות"""
    related = []
    for entity in entities:
        if entity.get('description'):
            # חלץ מילים מהתיאור
            words = entity['description'].split()
            related.extend([w.lower().strip('.,!?') for w in words if len(w) > 4])
    
    # החזר top 10 unique
    return list(set(related))[:10]

def generate_semantic_keywords(entities, language='en'):
    """יצירת מילות מפתח סמנטיות"""
    semantic_kw = []
    
    for entity in entities:
        if entity.get('types'):
            semantic_kw.extend(entity['types'])
        if entity.get('description'):
            words = entity['description'].lower().split()
            semantic_kw.extend([w for w in words if len(w) > 3])
    
    return list(set(semantic_kw))[:15]

if __name__ == '__main__':
    input_data = json.loads(sys.argv[1])
    result = enhanced_knowledge_graph(input_data)
    print(json.dumps(result, ensure_ascii=False))
