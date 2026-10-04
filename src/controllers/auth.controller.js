import {
  ensureUserHasName,
  loginUser,
  loginWithGoogle,
  registerUser,
  sanitizeUser,
  updateUserLanguagePreference,
  updateUserInterests,
} from "../services/auth.service.js";

export const register = async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json(result);
};

export const login = async (req, res) => {
  const result = await loginUser(req.body);
  res.status(200).json(result);
};

export const googleLogin = async (req, res) => {
  const result = await loginWithGoogle(req.body);
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

export const updateInterests = async (req, res) => {
  const user = await ensureUserHasName(req.user);
  const updatedUser = await updateUserInterests(user, req.body?.interests);
  res.status(200).json({ user: updatedUser });
};
