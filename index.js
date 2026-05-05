import dotenv from "dotenv";
dotenv.config();

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcrypt";
import hpp from "hpp";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import mongoose from "mongoose";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import { parseStringPromise } from "xml2js";
import { Blog, getBlogModel } from "./blog.model.js";
import { Comment } from "./comment.model.js";
import { News } from "./news.model.js";
import { User } from "./user.model.js";

const app = express();
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const allowedOrigins = (process.env.FRONT_END_URI || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const jwtSecret = process.env.JWT_SECRET || "change-me-in-env";
const jwtExpiresIn = "7d";
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    message: {
        error: "Too many requests",
        message: "Please try again in a few minutes."
    }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    message: {
        error: "Too many authentication attempts",
        message: "Please wait a few minutes before trying again."
    }
});

app.disable("x-powered-by");
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
}));
app.use(helmet({
    crossOriginResourcePolicy: false
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use((req, _res, next) => {
    const sanitizeOptions = {
        replaceWith: "_"
    };

    if (req.body) {
        mongoSanitize.sanitize(req.body, sanitizeOptions);
    }

    if (req.params) {
        mongoSanitize.sanitize(req.params, sanitizeOptions);
    }

    if (req.headers) {
        mongoSanitize.sanitize(req.headers, sanitizeOptions);
    }

    if (req.query) {
        mongoSanitize.sanitize(req.query, sanitizeOptions);
    }

    next();
});
app.use(hpp());
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

const HINDU_HOME_RSS = "https://www.thehindu.com/feeder/default.rss";
let cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000;
const BLOG_PLATFORM_URL = (
    process.env.BLOG_FRONT_END_URI || "https://blogs-frontend-omega.vercel.app"
).replace(/\/+$/, "");
const rustRssFetcherManifestPath = join(__dirname, "rss-fetcher", "Cargo.toml");
const rustRssFetcherBinaryPath = (process.env.RUST_RSS_FETCHER_BIN || "").trim();
let blogsConnection = null;
let externalBlogModel = Blog;

const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    favoriteCount: Array.isArray(user.favoriteLinks) ? user.favoriteLinks.length : 0
});

const createToken = (user) => jwt.sign(
    { sub: user._id.toString(), email: user.email },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
);

const extractToken = (req) => {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }

    return authHeader.slice(7).trim() || null;
};

const optionalAuth = async (req, _res, next) => {
    const token = extractToken(req);
    req.user = null;

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        req.user = await User.findById(payload.sub);
    } catch {
        req.user = null;
    }

    return next();
};

const requireAuth = async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const user = await User.findById(payload.sub);

        if (!user) {
            return res.status(401).json({ error: "Invalid token" });
        }

        req.user = user;
        return next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};

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

const runRustRssFetcher = async (rssUrl) => {
    const command = rustRssFetcherBinaryPath || "cargo";
    const args = rustRssFetcherBinaryPath
        ? [rssUrl]
        : ["run", "--quiet", "--manifest-path", rustRssFetcherManifestPath, "--", rssUrl];

    const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: __dirname,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20
    });

    const payload = stdout.trim();
    if (!payload) {
        throw new Error(stderr?.trim() || "Rust RSS fetcher returned empty output.");
    }

    try {
        return JSON.parse(payload);
    } catch (error) {
        throw new Error(`Rust RSS fetcher returned invalid JSON: ${error.message}`);
    }
};

const runNodeRssFetcher = async (rssUrl) => {
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

    const channel = parsed?.rss?.channel || {};
    let items = channel?.item || [];

    if (!Array.isArray(items)) {
        items = items ? [items] : [];
    }

    return {
        channel: {
            title: channel?.title,
            link: channel?.link,
            lastBuildDate: channel?.lastBuildDate
        },
        items
    };
};

async function syncNewsFromRss(rssUrl = HINDU_HOME_RSS) {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL_MS && rssUrl === HINDU_HOME_RSS) {
        return cache.data;
    }

    let fetchedFeed;

    try {
        fetchedFeed = await runRustRssFetcher(rssUrl);
    } catch (error) {
        console.warn("Rust RSS fetcher failed, falling back to Node fetcher:", error?.message || error);
        fetchedFeed = await runNodeRssFetcher(rssUrl);
    }

    const channel = fetchedFeed?.channel || {};
    const items = Array.isArray(fetchedFeed?.items) ? fetchedFeed.items : [];

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
                        }
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
const normalizeTitleKey = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");

const buildMongoUriForDatabase = (mongoUri, databaseName) => {
    if (!mongoUri || !databaseName) {
        return "";
    }

    try {
        const parsed = new URL(mongoUri);
        parsed.pathname = `/${databaseName}`;
        return parsed.toString();
    } catch {
        return mongoUri.replace(/\/([^/?]+)(\?.*)?$/, `/${databaseName}$2`);
    }
};

const attachMatchingBlogs = async (articles) => {
    if (!articles.length) {
        return articles;
    }

    const articleLinks = articles.map((article) => article.link).filter(Boolean);
    const articleTitles = articles
        .map((article) => article.title?.trim())
        .filter(Boolean);
    const blogCandidates = await externalBlogModel.find({
        $or: [
            articleLinks.length ? { url: { $in: articleLinks } } : null,
            articleLinks.length ? { sourceUrl: { $in: articleLinks } } : null,
            articleTitles.length ? { title: { $in: articleTitles } } : null
        ].filter(Boolean)
    })
        .select({ _id: 1, title: 1, url: 1, sourceUrl: 1 })
        .lean();

    const blogByUrl = new Map();
    const blogBySourceUrl = new Map();
    const blogByTitle = new Map();

    for (const blog of blogCandidates) {
        if (blog.url) {
            blogByUrl.set(blog.url, blog);
        }

        if (blog.sourceUrl) {
            blogBySourceUrl.set(blog.sourceUrl, blog);
        }

        if (blog.title) {
            blogByTitle.set(normalizeTitleKey(blog.title), blog);
        }
    }

    return articles.map((article) => {
        const matchedBlog =
            blogBySourceUrl.get(article.link) ||
            blogByUrl.get(article.link) ||
            (article.title ? blogByTitle.get(normalizeTitleKey(article.title)) : null);

        return {
            ...article,
            blogId: matchedBlog?._id?.toString() || null,
            blogUrl: matchedBlog ? `${BLOG_PLATFORM_URL}/${matchedBlog._id}` : ""
        };
    });
};

const buildNewsQuery = ({ tag, title, date, month, favoriteLinks }) => {
    const query = {};

    if (Array.isArray(favoriteLinks)) {
        query.link = favoriteLinks.length ? { $in: favoriteLinks } : { $in: [] };
    }

    if (tag && tag.trim()) {
        query.tags = { $regex: escapeRegex(tag.trim().toLowerCase()), $options: "i" };
    }

    if (title && title.trim()) {
        query.title = { $regex: escapeRegex(title.trim()), $options: "i" };
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

const getPaginatedNews = async ({ tag, title, date, month, page, favoriteLinks, userFavoriteLinks }) => {
    const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const limit = 9;
    const skip = (normalizedPage - 1) * limit;
    const query = buildNewsQuery({ tag, title, date, month, favoriteLinks });
    const favoriteSet = new Set(userFavoriteLinks || []);

    const [news, total] = await Promise.all([
        News.find(query)
            .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        News.countDocuments(query)
    ]);
    const itemsWithBlogs = await attachMatchingBlogs(news);

    return {
        count: news.length,
        total,
        page: normalizedPage,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        items: itemsWithBlogs.map((article) => ({
            ...article,
            isFavorite: favoriteSet.has(article.link)
        }))
    };
};

const getArticleByLink = async ({ link, userFavoriteLinks }) => {
    const normalizedLink = (link || "").trim();

    if (!normalizedLink) {
        return null;
    }

    const article = await News.findOne({ link: normalizedLink }).lean();
    if (!article) {
        return null;
    }

    const [articleWithBlog] = await attachMatchingBlogs([article]);
    const favoriteSet = new Set(userFavoriteLinks || []);

    return {
        ...articleWithBlog,
        isFavorite: favoriteSet.has(article.link)
    };
};

app.post("/api/auth/register", async (req, res) => {
    try {
        const name = (req.body?.name || "").trim();
        const email = (req.body?.email || "").trim().toLowerCase();
        const password = req.body?.password || "";

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            passwordHash
        });

        return res.status(201).json({
            token: createToken(user),
            user: sanitizeUser(user)
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to register",
            message: error?.message
        });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const email = (req.body?.email || "").trim().toLowerCase();
        const password = req.body?.password || "";

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        return res.status(200).json({
            token: createToken(user),
            user: sanitizeUser(user)
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to login",
            message: error?.message
        });
    }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.status(200).json({ user: sanitizeUser(req.user) });
});

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

app.get("/api/news", optionalAuth, async (req, res) => {
    try {
        const { tag, title, date, month } = req.query;
        const favoritesOnly = req.query.favoritesOnly === "true";
        const payload = await getPaginatedNews({
            tag,
            title,
            date,
            month,
            page: req.query.page,
            favoriteLinks: favoritesOnly ? (req.user?.favoriteLinks || []) : undefined,
            userFavoriteLinks: req.user?.favoriteLinks || []
        });

        res.status(200).json(payload);
    } catch (error) {
        res.status(500).json({
            error: "Failed to load news",
            message: error?.message
        });
    }
});

app.get("/api/news/article", optionalAuth, async (req, res) => {
    try {
        const article = await getArticleByLink({
            link: req.query.link,
            userFavoriteLinks: req.user?.favoriteLinks || []
        });

        if (!article) {
            return res.status(404).json({ error: "Article not found" });
        }

        return res.status(200).json({ item: article });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to load article",
            message: error?.message
        });
    }
});

app.post("/api/news/filter", optionalAuth, async (req, res) => {
    try {
        const { tag, title, date, month, page, favoritesOnly } = req.body || {};
        const payload = await getPaginatedNews({
            tag,
            title,
            date,
            month,
            page,
            favoriteLinks: favoritesOnly ? (req.user?.favoriteLinks || []) : undefined,
            userFavoriteLinks: req.user?.favoriteLinks || []
        });

        res.status(200).json(payload);
    } catch (error) {
        res.status(500).json({
            error: "Failed to load news",
            message: error?.message
        });
    }
});

app.get("/api/comments", async (req, res) => {
    try {
        const newsLink = (req.query.link || "").trim();

        if (!newsLink) {
            return res.status(400).json({ error: "Article link is required" });
        }

        const comments = await Comment.find({ newsLink })
            .sort({ createdAt: -1, _id: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({
            items: comments.map((comment) => ({
                id: comment._id.toString(),
                content: comment.content,
                userName: comment.userName,
                createdAt: comment.createdAt
            }))
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to load comments",
            message: error?.message
        });
    }
});

app.post("/api/comments", requireAuth, async (req, res) => {
    try {
        const newsLink = (req.body?.link || "").trim();
        const content = (req.body?.content || "").trim();

        if (!newsLink) {
            return res.status(400).json({ error: "Article link is required" });
        }

        if (!content) {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }

        if (content.length > 500) {
            return res.status(400).json({ error: "Comment must be 500 characters or fewer" });
        }

        const comment = await Comment.create({
            newsLink,
            content,
            user: req.user._id,
            userName: req.user.name || req.user.email
        });

        return res.status(201).json({
            item: {
                id: comment._id.toString(),
                content: comment.content,
                userName: comment.userName,
                createdAt: comment.createdAt
            }
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to add comment",
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

app.post("/api/favorites/toggle", requireAuth, async (req, res) => {
    try {
        const { link } = req.body || {};

        if (!link) {
            return res.status(400).json({ error: "Link is required" });
        }

        let news = await News.findOne({ link });
        if (!news) {
            const payload = normalizeFeedItem(req.body);
            news = await News.create(payload);
            cache = { data: null, ts: 0 };
        }

        const alreadyFavorite = req.user.favoriteLinks.includes(link);
        req.user.favoriteLinks = alreadyFavorite
            ? req.user.favoriteLinks.filter((favoriteLink) => favoriteLink !== link)
            : [...req.user.favoriteLinks, link];

        await req.user.save();

        return res.status(200).json({
            favorite: !alreadyFavorite,
            user: sanitizeUser(req.user)
        });
    } catch (error) {
        return res.status(500).json({
            error: "Failed to update favorite",
            message: error?.message
        });
    }
});

const connectDb = async () => {
    await mongoose.connect(process.env.MONGO_URI);
};

const connectBlogsDb = async () => {
    const explicitBlogsUri = (process.env.BLOGS_MONGO_URI || "").trim();
    const blogsUri = explicitBlogsUri || buildMongoUriForDatabase(process.env.MONGO_URI, "blogs");

    if (!blogsUri) {
        externalBlogModel = Blog;
        return;
    }

    if (blogsUri === process.env.MONGO_URI) {
        externalBlogModel = Blog;
        return;
    }

    blogsConnection = mongoose.createConnection(blogsUri, {
        serverSelectionTimeoutMS: 10000
    });

    await blogsConnection.asPromise();
    externalBlogModel = getBlogModel(blogsConnection);
};

const startBackgroundSync = () => {
    cron.schedule("*/10 * * * *", async () => {
        try {
            await syncNewsFromRss();
        } catch (error) {
            console.error("Scheduled news sync failed:", error?.message || error);
        }
    });
};

const startServer = async () => {
    try {
        await connectDb();
        await connectBlogsDb();
        await syncNewsFromRss();
        startBackgroundSync();

        app.listen(process.env.PORT, () => {
            console.log(`API running on http://localhost:${process.env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error?.message || error);
        process.exit(1);
    }
};

startServer();
