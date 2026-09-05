/**
 * Lattice edges.
 *
 * The structure assembles outward from the centre: each edge carries the radius
 * of its own midpoint, and a single growth uniform decides which edges exist
 * yet. That puts the whole "structures begin connecting" beat in one draw call
 * and one number, and makes it an exact function of scroll.
 */

export const latticeEdgeVertex = /* glsl */ `
  attribute float aRadius;
  attribute float aHighlight;

  uniform float uGrow;
  uniform float uSoftness;

  varying float vAlpha;
  varying float vHighlight;
  varying float vFogDepth;

  void main() {
    // Edges fade in over a band rather than switching on, so the boundary of
    // the growing structure reads as a frontier and not as a hard sphere.
    vAlpha = 1.0 - smoothstep(uGrow - uSoftness, uGrow, aRadius);
    vHighlight = aHighlight;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const latticeEdgeFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  uniform float uFogDensity;

  varying float vAlpha;
  varying float vHighlight;
  varying float vFogDepth;

  void main() {
    if (vAlpha < 0.01) discard;

    float f = vFogDepth * uFogDensity;
    float fogAmount = 1.0 - clamp(1.0 - exp(-f * f), 0.0, 1.0);

    vec3 color = mix(uColor, uHighlightColor, vHighlight);
    float alpha = vAlpha * uOpacity * fogAmount * mix(1.0, 2.2, vHighlight);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;
