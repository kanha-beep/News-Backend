import {
  ensureUserHasName,
  loginUser,
  registerUser,
  sanitizeUser,
  updateUserLanguagePreference,
} from "../services/auth.service.js";

export const register = async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json(result);
};

export const login = async (req, res) => {
  const result = await loginUser(req.body);
  res.status(200).json(result);
};

export const getCurrentUser = async (req, res) => {
  const user = await ensureUserHasName(req.user);
  res.status(200).json({ user: sanitizeUser(user) });
};

export const updateLanguagePreference = async (req, res) => {
  const user = await ensureUserHasName(req.user);
  const updatedUser = await updateUserLanguagePreference(user, req.body?.language);
  res.status(200).json({ user: updatedUser });
};
