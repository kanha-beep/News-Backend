import { recordVisit } from "../services/analytics.service.js";

export const createVisit = async (req, res) => {
  await recordVisit(req);
  res.status(201).json({ ok: true });
};
