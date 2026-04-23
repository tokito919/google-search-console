import { google } from "googleapis";
import { readFileSync } from "fs";

const creds = JSON.parse(readFileSync("./searchConsoleClaude.json", "utf8"));

const SITE_URL = "https://schetovoditelibg.com/";

const SITEMAP_URLS = [
  "https://schetovoditelibg.com/blog/",
  "https://schetovoditelibg.com/счетоводството-за-фрийлансъри/",
  "https://schetovoditelibg.com/blog-регистрация-на-фирма/",
  "https://schetovoditelibg.com/dds-promeni-2026/",
  "https://schetovoditelibg.com/evroto-v-bulgaria-za-firmi-i-schetovoditelite/",
  "https://schetovoditelibg.com/blog-декларация-член-50/",
  "https://schetovoditelibg.com/нови-изисквания-за-стоки-с-висок-фиска/",
  "https://schetovoditelibg.com/news-nap-utvardi-formata-i-reda-za-podavane/",
  "https://schetovoditelibg.com/нап-автоматично-въведе-новия-осигури/",
];

const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/webmasters"],
});

const searchconsole = google.searchconsole({ version: "v1", auth });

async function checkUrl(url) {
  try {
    const res = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: url,
        siteUrl: SITE_URL,
      },
    });
    const result = res.data.inspectionResult;
    const indexStatus = result?.indexStatusResult;
    return {
      url,
      verdict: indexStatus?.verdict,
      coverageState: indexStatus?.coverageState,
      robotsTxtState: indexStatus?.robotsTxtState,
      indexingState: indexStatus?.indexingState,
      lastCrawlTime: indexStatus?.lastCrawlTime,
    };
  } catch (err) {
    return { url, error: err.message };
  }
}

// Decode percent-encoded URLs for display
function decode(url) {
  try { return decodeURIComponent(url); } catch { return url; }
}

async function main() {
  console.log(`Проверяване на ${SITEMAP_URLS.length} URL-а...\n`);

  const indexed = [];
  const notIndexed = [];
  const errors = [];

  for (const url of SITEMAP_URLS) {
    const result = await checkUrl(url);
    if (result.error) {
      errors.push(result);
    } else if (result.verdict === "PASS") {
      indexed.push(result);
    } else {
      notIndexed.push(result);
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("=== ИНДЕКСИРАНИ (" + indexed.length + ") ===");
  for (const r of indexed) {
    console.log(`  ✓ ${decode(r.url)}`);
    console.log(`    Статус: ${r.coverageState} | Последно обхождане: ${r.lastCrawlTime || "N/A"}`);
  }

  console.log("\n=== НЕ СА ИНДЕКСИРАНИ (" + notIndexed.length + ") ===");
  for (const r of notIndexed) {
    console.log(`  ✗ ${decode(r.url)}`);
    console.log(`    Verdict: ${r.verdict} | Статус: ${r.coverageState} | Indexing: ${r.indexingState}`);
  }

  if (errors.length > 0) {
    console.log("\n=== ГРЕШКИ (" + errors.length + ") ===");
    for (const r of errors) {
      console.log(`  ! ${decode(r.url)}: ${r.error}`);
    }
  }
}

main();
