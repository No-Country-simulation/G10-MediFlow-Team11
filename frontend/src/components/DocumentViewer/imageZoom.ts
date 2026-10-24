export const IMAGE_ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8] as const;

export function nextImageZoomIndex(index: number, direction: -1 | 1): number {
  return Math.max(0, Math.min(IMAGE_ZOOM_LEVELS.length - 1, index + direction));
}

export function imageDisplaySize(
  natural: { width: number; height: number },
  available: { width: number; height: number },
  zoom: number,
): { width: number; height: number } | null {
  if (natural.width <= 0 || natural.height <= 0 || available.width <= 0 || available.height <= 0) return null;
  const fit = Math.min(1, available.width / natural.width, available.height / natural.height);
  return { width: natural.width * fit * zoom, height: natural.height * fit * zoom };
}
