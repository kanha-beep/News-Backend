import {
  deletePersistentUserData,
  getPersistentUserData,
  listPersistentUserData,
  setPersistentUserData,
} from "../services/redis-app-data.service.js";
import { badRequest } from "../utils/http.js";

export const listRedisAppData = async (req, res) => {
  const items = await listPersistentUserData(req.user._id);
  res.status(200).json({ items });
};

export const getRedisAppData = async (req, res) => {
  const item = await getPersistentUserData(req.user._id, req.params.key);

  if (!item) {
    throw badRequest("Redis app data not found");
  }

  res.status(200).json({ item });
};

export const putRedisAppData = async (req, res) => {
  const item = await setPersistentUserData(req.user._id, req.params.key, req.body?.value);
  res.status(200).json({ item });
};

export const removeRedisAppData = async (req, res) => {
  const item = await deletePersistentUserData(req.user._id, req.params.key);
  res.status(200).json({ item });
};
