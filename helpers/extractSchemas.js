module.exports = async function extractSchemas(page) {
    const jsonLdHandles = await page.$$eval('script[type="application/ld+json"]', scripts =>
        scripts.map(s => {
            try {
                return JSON.parse(s.innerText);
            } catch {
                return null;
            }
        }).filter(Boolean)
    );
    return jsonLdHandles;
};