import mongoose from "mongoose";
import { DEFAULT_LANGUAGE_CODE, LANGUAGE_OPTIONS } from "../config/languages.js";

const userSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // Google-only accounts do not have a local password.
    passwordHash: { type: String, default: "" },
    googleSubject: { type: String, unique: true, sparse: true, trim: true },
    preferredLanguage: {
        type: String,
        default: DEFAULT_LANGUAGE_CODE,
        enum: LANGUAGE_OPTIONS.map((language) => language.code),
        trim: true
    },
    favoriteLinks: { type: [String], default: [] },
    likedLinks: { type: [String], default: [] },
    dislikedLinks: { type: [String], default: [] },
    interests: { type: [String], default: [] }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
