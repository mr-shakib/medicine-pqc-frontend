import { CanvasTexture, LinearFilter, NoColorSpace, type Texture } from 'three';

/**
 * Runtime-generated relief map for a tablet's score line and engraving.
 *
 * Drawn to a canvas at load rather than fetched: the project ships no external
 * assets, and a debossed feature only needs a height field, which is a few
 * strokes of 2D drawing.
 *
 * Used as a bump map. Darker is lower, so the surface is white and the score
 * groove and engraved characters are dark, with soft shoulders so they catch a
 * highlight on one side and shadow on the other under the studio key — which is
 * exactly how a real pressed groove reads.
 *
 * Geometry would be the alternative, but a score line is not rotationally
 * symmetric and so cannot come from the lathe; adding it as separate meshes
 * would cost draw calls on an object whose whole point is that it is one.
 */
export interface TabletMarkingOptions {
  /** Texture resolution. 512 is ample for a bump map at this scale. */
  size?: number;
  /** Draw the bisecting score line. */
  score?: boolean;
  /** Width of the score groove, as a fraction of the tablet diameter. */
  scoreWidth?: number;
  /** Characters debossed onto the face. Empty string draws none. */
  marking?: string;
}

function createCanvas(size: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function createTabletMarkingTexture({
  size = 512,
  score = true,
  scoreWidth = 0.045,
  marking = 'MSP',
}: TabletMarkingOptions = {}): Texture {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Neutral surface height.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const centre = size / 2;

  if (score) {
    // A soft-shouldered trench rather than a hard bar: a flat-bottomed groove
    // with abrupt walls reads as a painted stripe once it is only a bump map.
    const halfWidth = (scoreWidth * size) / 2;
    const gradient = ctx.createLinearGradient(
      0,
      centre - halfWidth * 2.2,
      0,
      centre + halfWidth * 2.2,
    );
    // Steep shoulders and a dark, flat-ish floor. A gentle gradient reads as a
    // smudge; the groove needs a sharp wall on each side for the key light to
    // catch one and shadow the other.
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#f0f0f0');
    gradient.addColorStop(0.42, '#4a4a4a');
    gradient.addColorStop(0.5, '#101010');
    gradient.addColorStop(0.58, '#4a4a4a');
    gradient.addColorStop(0.7, '#f0f0f0');
    gradient.addColorStop(1, '#ffffff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, centre - halfWidth * 2.2, size, halfWidth * 4.4);
  }

  if (marking) {
    // Sits on the upper half, clear of the score line, as on a real punch.
    ctx.fillStyle = '#3a3a3a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${size * 0.15}px ui-monospace, "Courier New", monospace`;
    // Letter-spacing is not universally supported on canvas contexts, so the
    // characters are placed individually.
    const tracking = size * 0.028;
    const glyphs = [...marking];
    const widths = glyphs.map((g) => ctx.measureText(g).width);
    const total =
      widths.reduce((sum, w) => sum + w, 0) + tracking * (glyphs.length - 1);

    let x = centre - total / 2;
    for (let i = 0; i < glyphs.length; i++) {
      ctx.fillText(glyphs[i], x + widths[i] / 2, centre - size * 0.19);
      x += widths[i] + tracking;
    }
  }

  const texture = new CanvasTexture(canvas as HTMLCanvasElement);
  // A relief map is a height field, not colour. Tagging it sRGB would apply a
  // gamma decode to values that are already linear heights.
  texture.colorSpace = NoColorSpace;
  /*
    Canvas textures upload with `flipY` by default, which is right for a texture
    authored bottom-up and wrong for one drawn with the 2D context, where y runs
    downward. Left on, it lands the engraving upside down on the face — and
    compensating in the UVs mirrors it instead, because the flip is vertical and
    the correction would be horizontal.
  */
  texture.flipY = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
