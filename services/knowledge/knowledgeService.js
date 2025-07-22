const { exec } = require('child_process');
const path = require('path');

async function analyzeWithKnowledgeGraph(data) {
    const { keywords, language = 'en', includeWikidata = true } = data;
    
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '../../scripts/knowledge_graph.py');
        const inputData = JSON.stringify({ keywords, language, includeWikidata });
        
        exec(`python3 "${pythonScript}" '${inputData}'`, (error, stdout, stderr) => {
            if (error) {
                console.error('Python script error:', error);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.warn('Python script warning:', stderr);
            }
            
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                console.error('Failed to parse Python output:', stdout);
                reject(parseError);
            }
        });
    });
}

module.exports = {
    analyzeWithKnowledgeGraph
};
