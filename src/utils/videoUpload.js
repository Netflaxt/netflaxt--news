/* ─────────────────────────────────────────────────────────────
   src/utils/videoUpload.js
   Upload video su Cloudinary + parsing URL YouTube/Vimeo.
   Free tier Cloudinary: 25 GB storage + 25 GB bandwidth/mese.
   Per video più lunghi/eventi: usare embed YouTube/Vimeo gratis illimitato.
   ───────────────────────────────────────────────────────────── */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const MAX_VIDEO_MB = 100; // Soft limit lato client (free tier non ha cap singolo, ma evitiamo file enormi)

/* Upload diretto a Cloudinary endpoint video.
   onProgress(percent) per la progress bar.
   Ritorna oggetto con { url, type:'cloudinary', publicId, duration, format, thumbnail } */
export function uploadVideoToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error("Cloudinary non configurato (env mancanti)"));
      return;
    }
    if (!file) {
      reject(new Error("Nessun file"));
      return;
    }
    if (!file.type.startsWith("video/")) {
      reject(new Error("Il file non è un video"));
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_VIDEO_MB) {
      reject(
        new Error(
          `Video troppo grande (${sizeMb.toFixed(1)} MB). Limite: ${MAX_VIDEO_MB} MB. Comprimilo o usa un embed YouTube.`
        )
      );
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    fd.append("folder", "netflaxt/videos");
    // resource_type=video forza endpoint video (qualità auto-ottimizzata)

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`
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
          // Thumbnail = stesso video con estensione .jpg via Cloudinary
          const thumbnail = data.secure_url?.replace(/\.[a-z0-9]+$/i, ".jpg");
          resolve({
            url: data.secure_url,
            type: "cloudinary",
            publicId: data.public_id,
            duration: data.duration,
            format: data.format,
            width: data.width,
            height: data.height,
            thumbnail,
          });
        } else {
          reject(
            new Error(
              data?.error?.message ||
                `Upload fallito (${xhr.status}). Verifica che l'upload preset abiliti i video.`
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

/* Parsing URL YouTube → { id, embedUrl, thumbnail } */
export function parseYouTube(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/i,
    /^([\w-]{11})$/, // ID puro
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const id = m[1];
      return {
        id,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }
  return null;
}

/* Parsing URL Vimeo → { id, embedUrl } */
export function parseVimeo(url) {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (!m) return null;
  return {
    id: m[1],
    embedUrl: `https://player.vimeo.com/video/${m[1]}?title=0&byline=0&portrait=0`,
    thumbnail: null, // Vimeo non offre thumbnail diretto senza API
  };
}

/* Helper: dato un URL qualsiasi capisce di che tipo è e lo normalizza
   in oggetto { url, type, embedUrl?, thumbnail? } pronto da salvare. */
export function normalizeVideoFromUrl(url) {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  // YouTube
  const yt = parseYouTube(trimmed);
  if (yt) {
    return {
      url: yt.watchUrl,
      type: "youtube",
      embedUrl: yt.embedUrl,
      thumbnail: yt.thumbnail,
    };
  }
  // Vimeo
  const vm = parseVimeo(trimmed);
  if (vm) {
    return {
      url: trimmed,
      type: "vimeo",
      embedUrl: vm.embedUrl,
      thumbnail: vm.thumbnail,
    };
  }
  // URL diretto a un file mp4/webm (Cloudinary o altro CDN)
  if (/\.(mp4|webm|mov|m3u8)(\?|$)/i.test(trimmed)) {
    return {
      url: trimmed,
      type: "cloudinary", // trattato come video diretto
      thumbnail: null,
    };
  }
  return null;
}

/* Trasforma una URL video Cloudinary in MP4/H.264/AAC universale
   (compatibile iOS Safari + Android + desktop). Vedi ArticleVideo. */
export function toCloudinaryMp4(url) {
  if (!url || typeof url !== "string") return url;
  const m = url.match(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/i
  );
  if (!m) return url;
  let [, base, rest] = m;
  const hasTransforms = /^[a-z]+_[^/]+(,[a-z]+_[^/]+)*\//i.test(rest);
  if (hasTransforms) {
    if (!/f_mp4|f_auto/i.test(rest)) {
      const slash = rest.indexOf("/");
      rest = rest.slice(0, slash) + ",f_mp4,vc_h264,ac_aac" + rest.slice(slash);
    }
  } else {
    rest = "f_mp4,vc_h264,ac_aac,q_auto/" + rest;
  }
  rest = rest.replace(/\.(mov|webm|mkv|avi|m4v|hevc|3gp)(\?|$)/i, ".mp4$2");
  return base + rest;
}

/* Formatta durata video da secondi a "m:ss" */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
