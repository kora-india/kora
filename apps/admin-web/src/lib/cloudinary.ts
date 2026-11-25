import "server-only";
import { v2 as cloudinary } from "cloudinary";

/** Cloudinary, set up from the environment; null when it isn't configured. */
export function getCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) return null;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return {
    cloudinary,
    cloudName: cloud_name,
    apiKey: api_key,
    apiSecret: api_secret,
  };
}

export const UPLOADS_NOT_SET_UP =
  "File uploads aren't set up on this server yet.";
