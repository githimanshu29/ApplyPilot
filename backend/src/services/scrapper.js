import axios from "axios";
import * as cheerio from "cheerio";

// known job portal selectors — add more as needed
const PORTAL_SELECTORS = {
  "greenhouse.io": [".job__description", "#content"],
  "lever.co": [".section-wrapper", ".posting-description"],
  "wellfound.com": [".job-description", ".styles_description__"],
  "unstop.com": [".opportunity-detail", ".description"],
  "internshala.com": [".internship_other_details", ".about_company"],
  "naukri.com": [".job-desc", ".jd-desc"],
};

function getSelectorsForUrl(url) {
  for (const [domain, selectors] of Object.entries(PORTAL_SELECTORS)) {
    if (url.includes(domain)) return selectors;
  }
  // generic fallback selectors that work on most job pages
  return [
    ".job-description",
    ".job-details",
    "#job-description",
    "#jobDescriptionText",
    '[data-automation="jobAdDetails"]',
    ".description",
    "main",
    "article",
  ];
}

function cleanText(text) {
  return text
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/\n{3,}/g, "\n\n") // max 2 newlines
    .replace(/[^\x20-\x7E\n]/g, "") // remove non-ASCII
    .trim();
}

export async function scrapeJobFromUrl(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        // pretend to be a browser — reduces bot detection
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const $ = cheerio.load(response.data);

    // remove noise elements
    $("script, style, nav, header, footer, iframe, img, svg").remove();

    const selectors = getSelectorsForUrl(url);

    let extracted = "";

    // try each selector in order, stop at first that gives meaningful content
    for (const selector of selectors) {
      const text = $(selector).text();
      if (text && text.trim().length > 200) {
        extracted = text;
        break;
      }
    }

    // if no selector worked, take the full body text
    if (!extracted || extracted.trim().length < 200) {
      extracted = $("body").text();
    }

    const cleaned = cleanText(extracted);

    if (cleaned.length < 100) {
      throw new Error(
        "Extracted content too short — page may require login or JS rendering",
      );
    }

    // try to extract title and company from page meta
    const title =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";

    const company =
      $('[class*="company"]').first().text().trim() ||
      $('[class*="employer"]').first().text().trim() ||
      "";

    return {
      success: true,
      jdRaw: cleaned,
      title: cleanText(title),
      company: cleanText(company),
      url,
    };
  } catch (err) {
    // don't throw — return structured failure so controller can handle gracefully
    return {
      success: false,
      error: err.message,
      requiresManualPaste: true,
      url,
    };
  }
}
