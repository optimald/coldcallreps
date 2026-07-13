/**
 * Shared logo URL validation for brand create / patch.
 * Allows http(s), site paths, and compact data:image URLs from the upload square.
 */

const MAX_REMOTE = 500;
const MAX_DATA = 350_000; // ~256KB binary after base64

export function normalizeLogoUrlInput(raw: unknown): {
  logoUrl: string | null;
  error?: string;
} {
  if (raw == null) return { logoUrl: null };
  const value = String(raw).trim();
  if (!value) return { logoUrl: null };

  if (value.startsWith('data:image/')) {
    if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(value)) {
      return { logoUrl: null, error: 'Logo upload must be PNG, JPEG, GIF, WebP, or SVG' };
    }
    if (value.length > MAX_DATA) {
      return { logoUrl: null, error: 'Logo file is too large — try a smaller image' };
    }
    return { logoUrl: value };
  }

  if (value.startsWith('/')) {
    if (value.length > MAX_REMOTE) {
      return { logoUrl: null, error: 'logoUrl too long' };
    }
    return { logoUrl: value };
  }

  if (/^https?:\/\//i.test(value)) {
    if (value.length > MAX_REMOTE) {
      return { logoUrl: null, error: 'logoUrl too long' };
    }
    return { logoUrl: value };
  }

  return {
    logoUrl: null,
    error: 'Logo must be an https URL, site path, or uploaded image',
  };
}

/** Resize an image file to a square data URL for brand logos. */
export async function fileToLogoDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file');
  }
  if (file.size > 4_000_000) {
    throw new Error('Image must be under 4MB');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');

    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = mime === 'image/jpeg' ? 0.88 : undefined;
    return canvas.toDataURL(mime, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}
