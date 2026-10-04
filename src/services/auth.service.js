import bcrypt from "bcrypt";
import axios from "axios";
import { User } from "../model/user.model.js";
import { createToken } from "../middleware/auth.js";
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGE_CODES } from "../config/languages.js";
import { badRequest } from "../utils/http.js";
import { readString } from "../utils/validation.js";

const buildFallbackName = (email = "") => {
  const localPart = String(email).split("@")[0]?.trim();
  return localPart || "Writer";
};

export const ensureUserHasName = async (user, preferredName = "") => {
  if (!user) return user;

  const nextName = readString(preferredName, "Name", { max: 80 }) || user.name || buildFallbackName(user.email);

  if (user.name !== nextName) {
    user.name = nextName;
    await user.save();
  }

  return user;
};

export const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  preferredLanguage: user.preferredLanguage || DEFAULT_LANGUAGE_CODE,
  favoriteCount: Array.isArray(user.favoriteLinks) ? user.favoriteLinks.length : 0,
  likedCount: Array.isArray(user.likedLinks) ? user.likedLinks.length : 0,
  dislikedCount: Array.isArray(user.dislikedLinks) ? user.dislikedLinks.length : 0,
  interests: Array.isArray(user.interests) ? user.interests : [],
});

const normalizeInterests = (interests) => {
  if (!Array.isArray(interests)) throw badRequest("Interests must be a list of tags");

  const values = [...new Set(interests.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean))];
  if (values.length > 12) throw badRequest("Choose up to 12 interests");
  if (values.some((tag) => tag.length > 60)) throw badRequest("An interest is too long");
  return values;
};

export const updateUserInterests = async (user, interests) => {
  user.interests = normalizeInterests(interests);
  await user.save();
  return sanitizeUser(user);
};

export const loginWithGoogle = async ({ credential }) => {
  if (!env.GOOGLE_CLIENT_ID) throw badRequest("Google sign-in is not configured yet");
  const idToken = readString(credential, "Google credential", { required: true, max: 5000 });
  let tokenInfo;
  try {
    const response = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
      params: { id_token: idToken },
      timeout: 10000,
    });
    tokenInfo = response.data;
  } catch {
    throw badRequest("Google sign-in could not be verified");
  }

  if (tokenInfo?.aud !== env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(tokenInfo?.iss)) {
    throw badRequest("Google credential is not valid for this app");
  }
  if (tokenInfo?.email_verified !== "true" && tokenInfo?.email_verified !== true) {
    throw badRequest("Your Google email needs to be verified");
  }

  const email = readString(tokenInfo.email, "Google email", { required: true, max: 200, lowercase: true });
  const googleSubject = readString(tokenInfo.sub, "Google account", { required: true, max: 200 });
  let user = await User.findOne({ $or: [{ googleSubject }, { email }] });
  if (!user) {
    user = await User.create({ name: readString(tokenInfo.name, "Name", { max: 80 }) || buildFallbackName(email), email, googleSubject });
  } else if (!user.googleSubject) {
    user.googleSubject = googleSubject;
    await user.save();
  }
  await ensureUserHasName(user, tokenInfo.name);
  return { token: createToken(user), user: sanitizeUser(user) };
};

export const updateUserLanguagePreference = async (user, language) => {
  const normalizedLanguage = readString(language, "Language", {
    required: true,
    max: 20,
  });

  if (!SUPPORTED_LANGUAGE_CODES.has(normalizedLanguage)) {
    throw badRequest("Language is not supported");
  }

  if (user.preferredLanguage !== normalizedLanguage) {
    user.preferredLanguage = normalizedLanguage;
    await user.save();
  }

  return sanitizeUser(user);
};

export const registerUser = async (payload) => {
  const rawName = readString(payload?.name, "Name", { max: 80 });
  const email = readString(payload?.email, "Email", {
    required: true,
    max: 200,
    lowercase: true,
  });
  const password = readString(payload?.password, "Password", {
    required: true,
    min: 6,
    max: 200,
  });

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw badRequest("User already exists");
  }

  const name = rawName || buildFallbackName(email);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
  });

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
};

export const loginUser = async (payload) => {
  const email = readString(payload?.email, "Email", {
    required: true,
    max: 200,
    lowercase: true,
  });
  const password = readString(payload?.password, "Password", {
    required: true,
    max: 200,
  });

  const user = await User.findOne({ email });
  if (!user) {
    throw badRequest("Invalid credentials");
  }

  const passwordMatches = user.passwordHash && await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw badRequest("Invalid credentials");
  }

  await ensureUserHasName(user);

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
};
