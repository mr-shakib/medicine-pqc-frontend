/**
 * Backdrop shader — the chamber the objects float inside.
 *
 * This is a studio cyclorama, not a skybox: a soft vertical falloff from a
 * slightly-lifted horizon, with a broad elliptical pool behind the subject
 * carrying the current chapter's accent hue. The three ground colours and the
 * way the pool is combined both come from the palette, so the same shader
 * paints a dark chamber and a white cyclorama.
 *
 * The dither in the fragment stage is not optional. An 8-bit framebuffer only
 * has 256 levels per channel; a gradient this dark and this wide will show hard
 * banding rings without it. A sub-LSB of ordered noise breaks the quantisation
 * up into something the eye reads as continuous.
 */

export const backdropVertex = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    // The sphere is centred on the camera, so the local position IS the view
    // direction -- no matrix work needed to get a stable gradient.
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const backdropFragment = /* glsl */ `
  // highp is required. The dither below needs real mantissa bits, and at
  // mediump the gradient develops visible horizontal banding artefacts.
  precision highp float;

  uniform vec3 uHorizon;    // lifted colour at the horizon line
  uniform vec3 uFloor;      // colour below
  uniform vec3 uCeiling;    // colour above
  uniform vec3 uAccent;     // current chapter accent
  uniform float uAccentAmount;
  // 0 adds the pool to the ground, 1 tints the ground with it. A pool of light
  // is an addition in the dark; on a near-white ground addition does nothing,
  // and the same pool has to read as a colour the paper takes on.
  uniform float uAccentMultiply;
  uniform float uTime;

  varying vec3 vDirection;

  /**
   * Interleaved gradient noise (Jimenez). Chosen over the usual sin-based hash
   * because it stays well-conditioned at lower precision -- a sin hash
   * multiplied by 43758.0 aliases into visible stripes on some GPUs.
   */
  float ditherNoise(vec2 p) {
    return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
  }

  void main() {
    float y = vDirection.y;

    // Two-sided falloff from the horizon: the ceiling darkens faster than the
    // floor, which is what makes the space feel like a room with a lit floor
    // rather than an open sky.
    float up = smoothstep(0.0, 0.65, y);
    float down = smoothstep(0.0, -0.5, y);

    vec3 base = uHorizon;
    base = mix(base, uCeiling, up * up);
    base = mix(base, uFloor, down);

    // A broad, soft pool of accent light behind the subject. Elliptical --
    // wider than tall -- so it reads as a large softbox rather than a spotlight.
    vec2 pool = vec2(vDirection.x * 0.7, (y - 0.02) * 1.35);
    float glow = 1.0 - smoothstep(0.0, 0.85, length(pool));
    glow = pow(glow, 2.2);

    // Only ever a whisper of hue: the accent tints the space, it does not light it.
    float pooled = glow * uAccentAmount;
    vec3 color = mix(
      base + uAccent * pooled,
      base * mix(vec3(1.0), uAccent, pooled),
      uAccentMultiply
    );

    // Very slow breathing so a static hero shot is never perfectly dead.
    color *= 1.0 + sin(uTime * 0.18) * 0.012;

    // Sub-LSB dither. Without this the gradient bands into visible rings.
    float d = ditherNoise(gl_FragCoord.xy) - 0.5;
    color += d / 255.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;
