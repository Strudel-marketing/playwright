module.exports = async function getLinks(page) {
    const links = await page.$$eval('a', as => as.map(a => a.href));
    return {
        internal: links.filter(link => link.includes(location.hostname)),
        external: links.filter(link => !link.includes(location.hostname)),
    };
};