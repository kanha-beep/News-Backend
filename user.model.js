import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    favoriteLinks: { type: [String], default: [] }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
