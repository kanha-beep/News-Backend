import bcrypt from "bcrypt";
import { User } from "../model/user.model.js";
import { createToken } from "../middleware/auth.js";
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
  favoriteCount: Array.isArray(user.favoriteLinks) ? user.favoriteLinks.length : 0,
  likedCount: Array.isArray(user.likedLinks) ? user.likedLinks.length : 0,
  dislikedCount: Array.isArray(user.dislikedLinks) ? user.dislikedLinks.length : 0,
});

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

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw badRequest("Invalid credentials");
  }

  await ensureUserHasName(user);

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
};
