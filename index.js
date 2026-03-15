import dotenv from "dotenv"
dotenv.config()
import express from "express";
import axios from "axios";
import cors from "cors";
import { parseStringPromise } from "xml2js";
import { News } from "./news.model.js"
const app = express();
console.log("URI: ", process.env.FRONT_END_URI)
app.use(cors({
    origin: process.env.FRONT_END_URI, // your frontend URL
    credentials: true
}))


// Use the Hindu RSS feed (home)
const HINDU_HOME_RSS = "https://www.thehindu.com/feeder/default.rss";

// simple in-memory cache to reduce requests
let cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 60 * 1000; // 1 minute
async function saveNews(items) {
    for (const article of items) {
        const exists = await News.findOne({ link: article.link });

        if (!exists) {
            await News.create({
                title: article.title,
                link: article.link,
                description: article.description,
                pubDate: article.pubDate
            });
        }
    }
}
app.get("/api/hindu", async (req, res) => {
    try {
        // console.log("Fetching RSS feed...");
        const rssUrl = req.query.rssUrl || HINDU_HOME_RSS;
        // console.log("RSS URL:", rssUrl);
        // cache
        if (cache.data && Date.now() - cache.ts < CACHE_TTL_MS && rssUrl === HINDU_HOME_RSS) {
            return res.json(cache.data);
        }
        // console.log("Making HTTP request to fetch RSS...");
        const response = await axios.get(rssUrl, {
            timeout: 10000,
            headers: {
                // some sites behave better with a UA
                "User-Agent": "Mozilla/5.0 (RSS Reader; +https://example.com)"
            }
        });
        // console.log("RSS feed fetched, parsing XML...", response.status);
        const xml = response.data;
        // console.log("Parsing XML...", xml.substring(0, 200)); // log first 200 chars
        // convert xml to json
        const parsed = await parseStringPromise(xml, {
            explicitArray: false, //not convert string into array
            mergeAttrs: true,
            trim: true
        });

        // RSS structure: rss.channel.item
        const channel = parsed?.rss?.channel;
        let items = channel?.item || [];
        try {
            await saveNews(items);
        } catch (error) {
            console.log("error saved")
        }
        if (!Array.isArray(items)) items = [items];
        console.log(`Parsed ${items.length} items from RSS feed.`);
        const json = {
            source: "The Hindu (RSS)",
            title: channel?.title,
            link: channel?.link,
            updated: channel?.lastBuildDate,
            count: items.length,
            items: items.slice(0, 20).map((it) => {
                const category = getCategoryDetails(it.link);

                const built = {
                    title: it.title,
                    link: it.link,
                    pubDate: it.pubDate,
                    description: it.description,
                    guid: it.guid?._ || it.guid,
                    category: category.main,
                    subCategory: category.sub
                };

                built.tags = getTags(built);

                return built;
            })
        };

        // cache home feed only
        if (rssUrl === HINDU_HOME_RSS) {
            cache = { data: json, ts: Date.now() };
        }
        res.status(201).json(json);
    } catch (err) {
        res.status(500).json({
            error: "Failed to fetch/parse RSS",
            message: err?.message
        });
    }
});
const getCategoryDetails = (urlStr) => {
    try {
        const url = new URL(urlStr);
        const segments = url.pathname.split("/").filter(Boolean);

        return {
            level1: segments[0] || "general",      // news / sport / business
            level2: segments[1] || null,           // national / cities / international / cricket
            level3: segments[2] || null            // kerala / chennai / karnataka / etc.
        };
    } catch {
        return { level1: "general", level2: null, level3: null };
    }
};
const getTags = (item) => {
    const title = (item.title || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();
    const url = (item.link || "").toLowerCase();

    const text = `${title} ${desc}`;

    const tags = [];

    // Section-based
    if (url.includes("/sport/")) tags.push("sports");
    if (url.includes("/news/international/")) tags.push("international");
    if (url.includes("/business/")) tags.push("economy");
    if (url.includes("/opinion/")) tags.push("opinion");

    // Politics / Government
    if (
        text.includes("minister") ||
        text.includes("cabinet") ||
        text.includes("parliament") ||
        text.includes("bjp") ||
        text.includes("congress") ||
        text.includes("election") ||
        text.includes("chief minister") ||
        text.includes("pm modi") ||
        text.includes("prime minister")
    ) tags.push("politics");

    // Education
    if (
        text.includes("student") ||
        text.includes("exam") ||
        text.includes("university") ||
        text.includes("admission") ||
        text.includes("school") ||
        text.includes("cet")
    ) tags.push("education");

    // Crime / Law & Order (THIS will tag your examples)
    if (
        text.includes("arrest") ||
        text.includes("arrested") ||
        text.includes("seizure") ||
        text.includes("assault") ||
        text.includes("murder") ||
        text.includes("rape") ||
        text.includes("theft") ||
        text.includes("robbery") ||
        text.includes("case") ||
        text.includes("police") ||
        text.includes("court")
    ) tags.push("crime");

    // Drugs / Narcotics
    if (
        text.includes("ganja") ||
        text.includes("narcotic") ||
        text.includes("drug") ||
        text.includes("contraband") ||
        text.includes("smuggling")
    ) tags.push("drugs");

    // Health
    if (
        text.includes("hospital") ||
        text.includes("doctor") ||
        text.includes("health") ||
        text.includes("disease") ||
        text.includes("vaccine")
    ) tags.push("health");

    return [...new Set(tags)];
};
app.listen(process.env.PORT, () => console.log("API running on http://localhost:3000"));