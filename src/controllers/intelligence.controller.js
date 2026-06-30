import {
  buildIntelligenceOverview,
  getEventTimeline,
  listEventClusters,
  runSemanticSearch,
} from "../services/news.service.js";
import { badRequest } from "../utils/http.js";

export const getOverview = async (_req, res) => {
  const overview = await buildIntelligenceOverview();
  res.status(200).json(overview);
};

export const getEvents = async (_req, res) => {
  const items = await listEventClusters();
  res.status(200).json({ items });
};

export const getEvent = async (req, res) => {
  const item = await getEventTimeline(req.params.eventId);
  if (!item) {
    throw badRequest("Event not found");
  }

  res.status(200).json({ item });
};

export const searchIntelligence = async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    throw badRequest("Search query is required");
  }

  const items = await runSemanticSearch({
    query,
    userFavoriteLinks: req.user?.favoriteLinks || [],
    userLikedLinks: req.user?.likedLinks || [],
    userDislikedLinks: req.user?.dislikedLinks || [],
  });
  res.status(200).json({ items });
};
