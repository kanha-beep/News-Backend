import { Visit } from "../../visit.model.js";
import { readString } from "../utils/validation.js";

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || "";
};

const inferBrowser = (userAgent = "") => {
  const value = userAgent.toLowerCase();
  if (value.includes("edg/")) return "Edge";
  if (value.includes("chrome/")) return "Chrome";
  if (value.includes("safari/") && !value.includes("chrome/")) return "Safari";
  if (value.includes("firefox/")) return "Firefox";
  if (value.includes("opr/") || value.includes("opera/")) return "Opera";
  return "Unknown";
};

const inferOs = (userAgent = "") => {
  const value = userAgent.toLowerCase();
  if (value.includes("windows")) return "Windows";
  if (value.includes("android")) return "Android";
  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) return "iOS";
  if (value.includes("mac os")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return "Unknown";
};

const inferDeviceType = (userAgent = "") => {
  const value = userAgent.toLowerCase();
  if (value.includes("mobile")) return "Mobile";
  if (value.includes("tablet") || value.includes("ipad")) return "Tablet";
  return "Desktop";
};

export const recordVisit = async (req) => {
  const userAgent = req.headers["user-agent"] || "";

  await Visit.create({
    pageUrl: readString(req.body?.pageUrl, "Page URL", { max: 700 }),
    path: readString(req.body?.path, "Path", { max: 300 }),
    title: readString(req.body?.title, "Title", { max: 200 }),
    referrer: readString(req.body?.referrer, "Referrer", { max: 700 }),
    ipAddress: getClientIp(req),
    userAgent,
    browser: inferBrowser(userAgent),
    deviceType: inferDeviceType(userAgent),
    os: inferOs(userAgent),
    screen: readString(req.body?.screen, "Screen", { max: 50 }),
    timezone: readString(req.body?.timezone, "Timezone", { max: 100 }),
    language: readString(req.body?.language, "Language", { max: 50 }),
    country: String(req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || ""),
    region: String(req.headers["x-vercel-ip-country-region"] || req.headers["x-appengine-region"] || ""),
    city: String(req.headers["x-vercel-ip-city"] || ""),
  });
};
