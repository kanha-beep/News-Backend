import { checkAlerts, createAlert, deleteAlert, listAlerts, toggleAlert } from "../services/alert.service.js";

export const getAlerts = async (req, res) => {
  const items = await listAlerts(req.user._id);
  res.status(200).json({ items });
};

export const addAlert = async (req, res) => {
  const item = await createAlert(req.body, req.user._id);
  res.status(201).json({ item });
};

export const updateAlert = async (req, res) => {
  const item = await toggleAlert(req.params.alertId, req.body?.enabled, req.user._id);
  res.status(200).json({ item });
};

export const removeAlert = async (req, res) => {
  await deleteAlert(req.params.alertId, req.user._id);
  res.status(200).json({ ok: true });
};

export const runAlertCheck = async (req, res) => {
  const items = await checkAlerts(req.user._id);
  res.status(200).json({ items });
};
