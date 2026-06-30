import mongoose from "mongoose";
import { env } from "./env.js";
import { Blog, getBlogModel } from "../model/blog.model.js";

let blogsConnection = null;
let externalBlogModel = Blog;

const buildMongoUriForDatabase = (mongoUri, databaseName) => {
  if (!mongoUri || !databaseName) {
    return "";
  }

  try {
    const parsed = new URL(mongoUri);
    parsed.pathname = `/${databaseName}`;
    return parsed.toString();
  } catch {
    return mongoUri.replace(/\/([^/?]+)(\?.*)?$/, `/${databaseName}$2`);
  }
};

export const connectDb = async () => {
  await mongoose.connect(env.MONGO_URI);
};

export const connectBlogsDb = async () => {
  const blogsUri = env.BLOGS_MONGO_URI || buildMongoUriForDatabase(env.MONGO_URI, "blogs");

  if (!blogsUri || blogsUri === env.MONGO_URI) {
    externalBlogModel = Blog;
    return;
  }

  blogsConnection = mongoose.createConnection(blogsUri, {
    serverSelectionTimeoutMS: 10000,
  });

  await blogsConnection.asPromise();
  externalBlogModel = getBlogModel(blogsConnection);
};

export const getExternalBlogModel = () => externalBlogModel;
