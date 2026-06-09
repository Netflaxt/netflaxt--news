/* ─────────────────────────────────────────────────────────────
   src/utils/imageUpload.js
   Upload immagini (loghi squadre, foto custom) su Cloudinary.
   Riusa la stessa configurazione del videoUpload (same cloud).
   Formati supportati: PNG, JPEG/JPG, WEBP, SVG, GIF.
   ───────────────────────────────────────────────────────────── */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const MAX_IMAGE_MB = 10; // Cloudinary free: max 10 MB per immagine
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

/**
 * Comprime/ridimensiona un'immagine lato client PRIMA dell'upload.
 * Le foto del telefono (spesso 8-20 MB) vengono ridotte a pochi MB
 * senza perdita visibile → upload sempre possibile + chat fluida.
 *
 * - Salta SVG/GIF (vettoriali/animate: non vanno compresse su canvas)
 * - Salta immagini già piccole (< softLimitMB): nessuna perdita inutile
 * - Ridimensiona al lato massimo maxDim mantenendo le proporzioni
 * - Esporta in JPEG qualità 0.85 (ottimo compromesso peso/qualità)
 *
 * @returns {Promise<File>} il file compresso (o l'originale se non serve)
 */
export async function compressImage(
  file,
  { maxDim = 1920, quality = 0.85, softLimitMB = 1.5 } = {}
) {
  if (!file) return file;
  // Non comprimere formati non-raster o animati
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  // Immagini già leggere: lasciale così (preserva qualità/formato)
  if (file.size <= softLimitMB * 1024 * 1024) return file;

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // non ha aiutato

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("compressImage fallita, uso originale:", e);
    return file;
  }
}

/**
 * Upload immagine su Cloudinary (cartella netflaxt/logos).
 * @param {File} file
 * @param {(percent:number)=>void} onProgress
 * @returns {Promise<{url:string, type:"cloudinary", publicId:string, format:string, width:number, height:number}>}
 */
export function uploadImageToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error("Cloudinary non configurato (env mancanti)"));
      return;
    }
    if (!file) {
      reject(new Error("Nessun file"));
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      reject(
        new Error(
          "Formato non supportato. Usa PNG, JPG, WEBP, SVG o GIF."
        )
      );
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_IMAGE_MB) {
      reject(
        new Error(
          `Immagine troppo grande (${sizeMb.toFixed(1)} MB). Massimo ${MAX_IMAGE_MB} MB.`
        )
      );
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    fd.append("folder", "netflaxt/logos");

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            url: data.secure_url,
            type: "cloudinary",
            publicId: data.public_id,
            format: data.format,
            width: data.width,
            height: data.height,
          });
        } else {
          reject(
            new Error(
              data?.error?.message ||
                `Upload fallito (${xhr.status}). Verifica che l'upload preset Cloudinary accetti le immagini.`
            )
          );
        }
      } catch (e) {
        reject(new Error("Risposta Cloudinary non valida"));
      }
    };
    xhr.onerror = () => reject(new Error("Errore di rete durante l'upload"));
    xhr.send(fd);
  });
}
