import mongoose from "mongoose";

const newsSchema = new mongoose.Schema({
    title: String,
    link: { type: String, unique: true },
    description: String,
    pubDate: Date
});
export const News = mongoose.model("New", newsSchema)