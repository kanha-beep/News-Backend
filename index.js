import dotenv from "dotenv";
dotenv.config();
import express from "express";
import axios from "axios";
import cors from "cors";
import { parseStringPromise } from "xml2js";
import { News } from "./news.model.js";
import mongoose from "mongoose";

const app = express();

console.log("URI: ", process.env.FRONT_END_URI);
const allowedOrigins = process.env.FRONT_END_URI.split(",");

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

const HINDU_HOME_RSS = "https://www.thehindu.com/feeder/default.rss";

async function db() {
    await mongoose.connect(process.env.MONGO_URI);
}

db();

let cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000;

const parsePublishedAt = (pubDate) => {
    const date = pubDate ? new Date(pubDate) : null;
    return Number.isNaN(date?.getTime()) ? null : date;
};

const buildDateKeys = (publishedAt) => {
    if (!publishedAt) {
        return {
            publishedDateKey: "",
            publishedMonthKey: ""
        };
    }

    const year = publishedAt.getFullYear();
    const month = String(publishedAt.getMonth() + 1).padStart(2, "0");
    const day = String(publishedAt.getDate()).padStart(2, "0");

    return {
        publishedDateKey: `${year}-${month}-${day}`,
        publishedMonthKey: `${year}-${month}`
    };
};

const getCategoryDetails = (urlStr) => {
    try {
        const url = new URL(urlStr);
        const segments = url.pathname.split("/").filter(Boolean);

        return {
            level1: segments[0] || "general",
            level2: segments[1] || null,
            level3: segments[2] || null
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

    if (url.includes("/sport/")) tags.push("sports");
    if (url.includes("/news/international/")) tags.push("international");
    if (url.includes("/business/")) tags.push("economy");
    if (url.includes("/opinion/")) tags.push("opinion");

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

    if (
        text.includes("student") ||
        text.includes("exam") ||
        text.includes("university") ||
        text.includes("admission") ||
        text.includes("school") ||
        text.includes("cet")
    ) tags.push("education");

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

    if (
        text.includes("ganja") ||
        text.includes("narcotic") ||
        text.includes("drug") ||
        text.includes("contraband") ||
        text.includes("smuggling")
    ) tags.push("drugs");

    if (
        text.includes("hospital") ||
        text.includes("doctor") ||
        text.includes("health") ||
        text.includes("disease") ||
        text.includes("vaccine")
    ) tags.push("health");

    return [...new Set(tags)];
};

const normalizeFeedItem = (item) => {
    const category = getCategoryDetails(item.link);
    const publishedAt = parsePublishedAt(item.pubDate);
    const dateKeys = buildDateKeys(publishedAt);

    const normalized = {
        title: item.title || "",
        link: item.link,
        pubDate: item.pubDate || "",
        publishedAt,
        publishedDateKey: dateKeys.publishedDateKey,
        publishedMonthKey: dateKeys.publishedMonthKey,
        description: item.description || "",
        guid: item.guid?._ || item.guid,
        category: category.level1,
        subCategory: category.level2,
        tags: []
    };

    normalized.tags = getTags(normalized);

    return normalized;
};

async function syncNewsFromRss(rssUrl = HINDU_HOME_RSS) {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL_MS && rssUrl === HINDU_HOME_RSS) {
        return cache.data;
    }

    const response = await axios.get(rssUrl, {
        timeout: 10000,
        headers: {
            "User-Agent": "Mozilla/5.0 (RSS Reader; +https://example.com)"
        }
    });

    const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true
    });

    const channel = parsed?.rss?.channel;
    let items = channel?.item || [];
    if (!Array.isArray(items)) items = [items];

    const normalizedItems = items
        .filter((item) => item?.link)
        .map(normalizeFeedItem);

    if (normalizedItems.length) {
        await News.bulkWrite(
            normalizedItems.map((article) => ({
                updateOne: {
                    filter: { link: article.link },
                    update: {
                        $set: {
                            title: article.title,
                            description: article.description,
                            pubDate: article.pubDate,
                            publishedAt: article.publishedAt,
                            publishedDateKey: article.publishedDateKey,
                            publishedMonthKey: article.publishedMonthKey,
                            category: article.category,
                            subCategory: article.subCategory,
                            tags: article.tags
                        },
                        $setOnInsert: { favorite: false }
                    },
                    upsert: true
                }
            })),
            { ordered: false }
        );
    }

    const json = {
        source: "The Hindu (RSS)",
        title: channel?.title,
        link: channel?.link,
        updated: channel?.lastBuildDate,
        count: normalizedItems.length,
        items: normalizedItems
    };

    if (rssUrl === HINDU_HOME_RSS) {
        cache = { data: json, ts: Date.now() };
    }

    return json;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildNewsQuery = ({ favorite, tag, date, month }) => {
    const query = {};

    if (favorite === "true") {
        query.favorite = true;
    }

    if (tag && tag.trim()) {
        query.tags = { $regex: escapeRegex(tag.trim().toLowerCase()), $options: "i" };
    }

    if (date) {
        const normalizedDate = date.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            query.publishedDateKey = normalizedDate;
        }
    } else if (month) {
        const normalizedMonth = month.trim();
        if (/^\d{4}-\d{2}$/.test(normalizedMonth)) {
            query.publishedMonthKey = normalizedMonth;
        }
    }

    return query;
};

app.get("/api/hindu", async (req, res) => {
    try {
        const rssUrl = req.query.rssUrl || HINDU_HOME_RSS;
        const json = await syncNewsFromRss(rssUrl);
        res.status(200).json(json);
    } catch (err) {
        res.status(500).json({
            error: "Failed to fetch/parse RSS",
            message: err?.message
        });
    }
});

app.get("/api/news", async (req, res) => {
    try {
        const { favorite, tag, date, month } = req.query;
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
        const skip = (page - 1) * limit;
        const query = buildNewsQuery({ favorite, tag, date, month });

        const [news, total] = await Promise.all([
            News.find(query)
            .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
            News.countDocuments(query)
        ]);

        res.status(200).json({
            count: news.length,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            items: news
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load news",
            message: error?.message
        });
    }
});

app.get("/api/tags", async (_req, res) => {
    try {
        const tags = await News.distinct("tags");
        res.status(200).json({
            items: tags.filter(Boolean).sort((a, b) => a.localeCompare(b))
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load tags",
            message: error?.message
        });
    }
});

app.post("/api/favorite", async (req, res) => {
    const { link } = req.body;
    if (!link) {
        return res.status(400).json({ error: "Link is required" });
    }

    const news = await News.findOne({ link });
    if (!news) {
        const payload = normalizeFeedItem(req.body);
        const newNews = await News.create({ ...payload, favorite: true });
        cache = { data: null, ts: 0 };
        return res.json(newNews);
    }

    news.favorite = !news.favorite;
    await news.save();
    cache = { data: null, ts: 0 };
    res.status(200).json(news);
});

app.listen(process.env.PORT, () => console.log("API running on http://localhost:3000"));
