/** OpenAI Whisper practical file-size limit. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = [
  "audio/",
  "video/webm",
  "video/mp4",
  "application/ogg",
];

export function transcribeAudioRejection(
  audio: Blob & { name?: string; type?: string },
): string | null {
  const size = typeof audio.size === "number" ? audio.size : 0;
  if (size <= 0) {
    return "The audio file is empty.";
  }
  if (size > MAX_TRANSCRIBE_BYTES) {
    return "That recording is too large to transcribe (maximum 25 MB).";
  }
  const type = (audio.type || "").toLowerCase();
  if (type && !ALLOWED_AUDIO_TYPES.some((prefix) => type.startsWith(prefix))) {
    return "That file type cannot be transcribed. Use an audio recording.";
  }
  return null;
}
