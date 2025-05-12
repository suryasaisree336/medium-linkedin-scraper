// medium-scraper/index.js

const { chromium } = require('playwright');
const fs = require('fs');

const searchTopics = [
  'artificial intelligence',
  'blockchain',
  'web3',
  'machine learning',
  'data science',
  'cloud computing',
  'cybersecurity'
];

async function scrapeMediumForTopic(topic) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const searchUrl = `https://medium.com/search?q=${encodeURIComponent(topic)}`;
  console.log(`[${new Date().toLocaleString()}] 🔍 Searching: "${topic}" - ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  try {
    await page.waitForSelector('article', { timeout: 60000 });
  } catch (err) {
    console.error(`❌ Error for "${topic}": ${err.message}`);
    await browser.close();
    return [];
  }

  const articles = await page.$$eval('article', nodes => {
    return nodes.slice(0, 10).map(node => {
      const titleEl = node.querySelector('h2');
      const linkEl = node.querySelector('a');
      const authorEl = node.querySelector('a[href*="@"]');

      return {
        title: titleEl?.innerText || 'No title',
        author: authorEl?.innerText || 'Unknown author',
        url: linkEl?.href || 'No link',
      };
    });
  });

  await browser.close();
  return articles;
}

async function searchLinkedIn(author) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const query = encodeURIComponent(`${author} site:linkedin.com/in`);

  await page.goto(`https://www.google.com/search?q=${query}`);

  try {
    await page.waitForSelector('a[href*="linkedin.com/in"]', { timeout: 10000 });
    const link = await page.$eval('a[href*="linkedin.com/in"]', el => el.href);
    await browser.close();
    return link;
  } catch (e) {
    await browser.close();
    return 'Not found';
  }
}

(async () => {
  const results = [];

  for (const topic of searchTopics) {
    const articles = await scrapeMediumForTopic(topic);
    for (const article of articles) {
      const exists = results.find(item => item.author === article.author);
      if (article.author !== 'Unknown author' && !exists) {
        const linkedin = await searchLinkedIn(article.author);
        results.push({
          author: article.author,
          article_title: article.title,
          medium_url: article.url,
          linkedin_url: linkedin
        });
      }
      if (results.length >= 10) break;
    }
    if (results.length >= 10) break;
  }

  fs.writeFileSync('authors.json', JSON.stringify(results, null, 2));
  console.log(`✅ Scraped ${results.length} authors and saved to authors.json`);
})();