import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { accent, neutral } from '@/lib/design/tokens';

/**
 * A name plate for one identity record in the team registry.
 *
 * Drawn to a canvas at load, like the vial label and the tablet's relief map.
 * The alternative -- an SDF text renderer -- would pull in a font pipeline and
 * a worker to set twenty short lines that never change, and would still need
 * its own material. A canvas texture is one upload and reuses the same basic
 * material every other plate uses.
 *
 * Typography mirrors the DOM's chapter marker exactly: the name in the display
 * face, the role in the tracked monospace label voice underneath. System stacks
 * rather than the page's webfont, because a canvas can only draw a face the
 * browser has already loaded and the plate is built before that is guaranteed;
 * the same choice the other two textures make.
 */
export interface NamePlateOptions {
  name: string;
  role: string;
  width?: number;
  height?: number;
  /** Colour of the role line. Pass an accent family's `light` step. */
  accentColor?: string;
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Set `text` at `size`, stepping the size down until it fits `maxWidth`.
 *
 * The roster holds names from eleven to twenty-four characters. Letting the
 * longest one set the size for all of them would leave the short ones looking
 * timid; scaling only the few that overrun keeps the plate optically even.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  size: number,
  maxWidth: number,
): void {
  let current = size;
  ctx.font = font(current);
  while (ctx.measureText(text).width > maxWidth && current > size * 0.6) {
    current -= 1;
    ctx.font = font(current);
  }
}

export function createNamePlateTexture({
  name,
  role,
  width = 640,
  height = 192,
  accentColor = accent.pharma.light,
}: NamePlateOptions): Texture {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Transparent ground: the plate is a caption floating in the chamber, not a
  // card. Anything opaque here would read as the ID badge this is not.
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const centre = width / 2;
  const inset = width * 0.06;

  ctx.fillStyle = neutral.n12;
  ctx.letterSpacing = '-1px';
  fitFont(
    ctx,
    name,
    (size) => `300 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`,
    Math.round(height * 0.26),
    width - inset * 2,
  );
  ctx.fillText(name, centre, height * 0.46);

  ctx.fillStyle = accentColor;
  ctx.letterSpacing = `${Math.round(height * 0.055)}px`;
  fitFont(
    ctx,
    role.toUpperCase(),
    (size) => `400 ${size}px ui-monospace, "SF Mono", "Courier New", monospace`,
    Math.round(height * 0.105),
    width - inset * 2,
  );
  /*
    Tracking is applied AFTER the last glyph as well as between glyphs, so a
    centred tracked line sits half a track left of true centre. Nudging it back
    is the difference between the role reading as centred and reading as very
    slightly wrong.
  */
  const track = Math.round(height * 0.055);
  ctx.fillText(role.toUpperCase(), centre + track / 2, height * 0.72);

  ctx.letterSpacing = '0px';

  const texture = new CanvasTexture(canvas as HTMLCanvasElement);
  texture.colorSpace = SRGBColorSpace;
  /*
    Mipmapped, despite the plate being read at close to texture resolution on
    a desktop viewport.

    It is not read at that size everywhere: a narrow window minifies it, and a
    tracked monospace line at a hairline weight is exactly the content that
    shimmers when a minified texture is point-sampled -- and it shimmers while
    the ring is turning, which is the whole chapter. Anisotropy keeps it sharp
    at the angle the compositional offset views it from.
  */
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
