export const AUDIO_BUCKET = "experiment-audio";
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MIN_AUDIO_MS = 20_000;
export const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
export const audioBaseMime = (type: string) => type.toLowerCase().split(";")[0].trim();
export const audioExtension = (type: string) => ({ "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" } as Record<string, string>)[audioBaseMime(type)] ?? null;
