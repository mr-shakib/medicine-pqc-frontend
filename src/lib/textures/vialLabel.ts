import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';
import { neutral } from '@/lib/design/tokens';

/**
 * Runtime-generated pharmaceutical label.
 *
 * Drawn to a canvas at load, like the tablet's relief map — the project ships
 * no external assets. It wraps a cylinder, so the artwork occupies the middle
 * of a wide canvas and the seam falls in blank margin where the join is
 * invisible.
 *
 * Deliberately sparse. A real vial label is dense with regulatory text, but at
 * the scale this renders that becomes grey mush; a few legible elements with
 * generous space read as "pharmaceutical" far more convincingly, and match the
 * restraint of the rest of the piece.
 */
export interface VialLabelOptions {
  width?: number;
  height?: number;
  /** Product name, set small above the strength. */
  name?: string;
  /** The one large element. */
  strength?: string;
  /** Monospaced batch line. */
  lot?: string;
  /** Accent rule colour. */
  accent?: string;
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function createVialLabelTexture({
  width = 1024,
  height = 256,
  name = 'MEDSECURE',
  strength = '10 mg / mL',
  lot = 'LOT 4A7C21 · 2 mL · STERILE',
  accent = '#be8b4e',
}: VialLabelOptions = {}): Texture {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Paper stock. Slightly warm off-white, never pure white.
  ctx.fillStyle = '#ece8e0';
  ctx.fillRect(0, 0, width, height);


  /*
    Artwork occupies most of the width, with blank margin at each end for the
    wrap seam to land in. Wider than it first needs to be on purpose: the label
    only covers part of the circumference, so at any given viewing angle only a
    slice of it faces the camera, and a narrow block of artwork rotates out of
    sight almost immediately.
  */
  const left = width * 0.16;
  const contentWidth = width * 0.68;

  // Accent rule.
  ctx.fillStyle = accent;
  ctx.fillRect(left, height * 0.2, contentWidth * 0.18, 3);

  ctx.fillStyle = '#3a3630';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${height * 0.085}px ui-monospace, "Courier New", monospace`;
  ctx.letterSpacing = `${height * 0.03}px`;
  ctx.fillText(name, left, height * 0.36);

  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#22201d';
  ctx.font = `300 ${height * 0.17}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(strength, left, height * 0.62);

  ctx.fillStyle = '#6b655c';
  ctx.font = `400 ${height * 0.062}px ui-monospace, "Courier New", monospace`;
  ctx.fillText(lot, left, height * 0.78);

  // A minimal batch code block. Bars rather than a real barcode: a scannable
  // pattern would be a functional claim this object should not make.
  const barTop = height * 0.85;
  const barHeight = height * 0.08;
  let x = left;
  for (let i = 0; i < 34 && x < left + contentWidth * 0.55; i++) {
    const w = 2 + ((i * 7919) % 5);
    if (i % 3 !== 0) {
      ctx.fillStyle = '#3a3630';
      ctx.fillRect(x, barTop, w, barHeight);
    }
    x += w + 2;
  }

  // Faint edge shading, so the label reads as applied stock rather than paint.
  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, 'rgba(0,0,0,0.18)');
  edge.addColorStop(0.12, 'rgba(0,0,0,0)');
  edge.addColorStop(0.88, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);

  const texture = new CanvasTexture(canvas as HTMLCanvasElement);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  /*
    Orientation for a cylinder wrap, which is NOT the same as the tablet's
    planar projection.

    A cylinder's V runs bottom-to-top, so the default `flipY` is already correct
    here — unlike the tablet's planar projection, which needs it disabled.

    No horizontal correction is needed either: CylinderGeometry's U increases
    with theta, and theta advances from +Z toward +X, which is left-to-right as
    seen from outside. Both flips tried here made it worse.
  */
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

/** Neutral fallback so the label material always has a defined base colour. */
export const LABEL_PAPER = neutral.n12;
