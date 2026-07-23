import { createClient } from "@/lib/supabase/client";

export const LABEL_BUCKET = "wine-labels";

export function labelImagePath(userId: string, wineId: string): string {
  return `${userId}/${wineId}.jpg`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Imagen de etiqueta inválida.");
  }
  const mime = match[1] || "image/jpeg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** Upload scanned label JPEG; returns storage path to persist on the wine. */
export async function uploadLabelImage(
  userId: string,
  wineId: string,
  dataUrl: string
): Promise<string> {
  const supabase = createClient();
  const path = labelImagePath(userId, wineId);
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage
    .from(LABEL_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || "No se pudo subir la etiqueta.");
  }

  return path;
}

/** Resolve a stored path to a temporary signed URL for display. */
export async function resolveLabelImageUrl(
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  // Already a full URL (legacy / unexpected)
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(LABEL_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
