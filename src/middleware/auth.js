import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../../user.model.js";

const extractToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim() || null;
};

export const createToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );

export const optionalAuth = async (req, _res, next) => {
  req.user = null;
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = await User.findById(payload.sub);
  } catch {
    req.user = null;
  }

  return next();
};

export const requireAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
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
