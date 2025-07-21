module.exports = function cleanHTML(html) {
    return html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
               .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
               .replace(/<!--.*?-->/g, '')
               .replace(/<[^>]+>/g, '')
               .trim();
};