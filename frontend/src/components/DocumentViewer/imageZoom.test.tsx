import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DocumentViewer from "./DocumentViewer";
import { IMAGE_ZOOM_LEVELS, imageDisplaySize, nextImageZoomIndex } from "./imageZoom";

describe("image document zoom", () => {
  it("fits portrait and wide images without stretching or enlarging small originals", () => {
    expect(imageDisplaySize({ width: 1200, height: 2400 }, { width: 600, height: 600 }, 1))
      .toEqual({ width: 300, height: 600 });
    expect(imageDisplaySize({ width: 2400, height: 1200 }, { width: 600, height: 600 }, 1))
      .toEqual({ width: 600, height: 300 });
    expect(imageDisplaySize({ width: 200, height: 100 }, { width: 600, height: 600 }, 1))
      .toEqual({ width: 200, height: 100 });
    expect(imageDisplaySize({ width: 1200, height: 2400 }, { width: 600, height: 600 }, 4))
      .toEqual({ width: 1200, height: 2400 });
    expect(imageDisplaySize({ width: 1200, height: 2400 }, { width: 0, height: 600 }, 1)).toBeNull();
  });

  it("moves through bounded zoom levels and can return to fit", () => {
    expect(IMAGE_ZOOM_LEVELS[0]).toBe(1);
    expect(nextImageZoomIndex(0, -1)).toBe(0);
    expect(nextImageZoomIndex(0, 1)).toBe(1);
    expect(nextImageZoomIndex(1, -1)).toBe(0);
    expect(nextImageZoomIndex(IMAGE_ZOOM_LEVELS.length - 1, 1)).toBe(IMAGE_ZOOM_LEVELS.length - 1);
  });

  it.each(["image/jpeg", "image/png"] as const)("renders labelled native controls for %s", (mimeType) => {
    const markup = renderToStaticMarkup(<DocumentViewer
      document={{ status: "ready", documentKey: mimeType, blob: new Blob([], { type: mimeType }), mimeType }}
      ariaLabel="Documento original" />);
    expect(markup).toContain('role="group" aria-label="Zoom de imagen"');
    expect(markup).toContain('aria-label="Alejar imagen"');
    expect(markup).toContain('aria-label="Acercar imagen"');
    expect(markup).toContain('aria-label="Restablecer ajuste de imagen"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="Imagen del documento; use las flechas para desplazarse al ampliar"');
  });
});
