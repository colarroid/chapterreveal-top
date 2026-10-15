"use client";

// Uploading shared backgrounds from the browser: straight to Cloudinary with
// a signature from this site, then recorded. Same rules as a church's own
// uploads in the main app (src/lib/display/backgrounds.ts there).

export interface SharedBackground {
  id: string;
  kind: "image" | "video";
  url: string;
  name: string;
  bytes: number;
  created_at: string;
}

export const IMAGE_MAX = 8 * 1024 * 1024;
export const VIDEO_MAX = 80 * 1024 * 1024;
export const VIDEO_SECONDS = 30;
/** Big files go up in 20 MB pieces: a dropped connection costs one piece, not the whole video. */
const CHUNK = 20 * 1024 * 1024;

function videoSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** "Faded lights" from "fadedlights-8_HD.mp4"-style names: a starting point to edit. */
export function nameFromFile(file: string): string {
  const base = file
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(hd|4k|uhd|1080p?|720p?|\d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return (base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()).slice(0, 60);
}

/** Checks the file, uploads it and records it. Throws an Error with a message to show. */
export async function uploadShared(file: File, name: string, onProgress?: (fraction: number) => void): Promise<SharedBackground> {
  const video = file.type.startsWith("video/");
  if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP picture, or an MP4, MOV or WebM video.");
  if (!video && file.size > IMAGE_MAX) throw new Error("That picture is over 8 MB. Save a smaller copy (1920 pixels wide is plenty).");
  if (video && file.size > VIDEO_MAX) throw new Error("That video is over 80 MB. Use a shorter loop, or export it at a lower bitrate.");
  if (video && (await videoSeconds(file)) > VIDEO_SECONDS + 1) throw new Error(`Background videos must be ${VIDEO_SECONDS} seconds or shorter. They loop, so a short one works.`);

  const signRes = await fetch("/api/backgrounds/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: video ? "video" : "image" }),
  });
  const signed = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new Error(signed.error ?? "Couldn't start the upload.");

  const uploaded = await sendToCloudinary(signed.url, signed.fields as Record<string, string>, file, onProgress);

  const res = await fetch("/api/backgrounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...uploaded, name }),
  });
  const saved = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(saved.error ?? "Couldn't save the upload.");
  return saved as SharedBackground;
}

export async function deleteShared(id: string): Promise<void> {
  const res = await fetch(`/api/backgrounds/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't delete it.");
}

interface CloudinaryResult {
  public_id: string;
  resource_type: string;
  bytes: number;
}

/** One request, with progress (XMLHttpRequest: fetch can't report upload progress). */
function post(url: string, form: FormData, headers: Record<string, string>, onProgress: (loaded: number) => void): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error?.message ? `Upload failed: ${data.error.message}` : "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check the connection and try again."));
    xhr.send(form);
  });
}

/** In one go, or for big files in 20 MB pieces tied together by an upload id. */
async function sendToCloudinary(url: string, fields: Record<string, string>, file: File, onProgress?: (fraction: number) => void): Promise<CloudinaryResult> {
  const form = (blob: Blob) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    f.append("file", blob, file.name);
    return f;
  };
  if (file.size <= CHUNK) return post(url, form(file), {}, (loaded) => onProgress?.(loaded / file.size));

  const uploadId = crypto.randomUUID();
  let result: CloudinaryResult | null = null;
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size);
    result = await post(url, form(file.slice(start, end)), { "X-Unique-Upload-Id": uploadId, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` }, (loaded) =>
      onProgress?.((start + loaded) / file.size),
    );
  }
  return result!;
}
