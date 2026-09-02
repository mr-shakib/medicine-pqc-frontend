/**
 * Suspended motes — small drifting particles.
 *
 * Shared by the medicine core and the capsule formation. Each point carries its
 * own phase and scale attribute, so the drift is per-particle rather than a
 * rigid transform of the whole cloud.
 */

export const motesVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aScale;

  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uDrift;
  uniform float uConverge;

  varying float vScale;
  varying float vFogDepth;

  void main() {
    // Per-point drift. Three incommensurate frequencies so no two motes ever
    // fall into step -- that lockstep is the tell of a cheap particle system.
    float t = uTime * 0.22 + aPhase;
    vec3 drift = vec3(
      sin(t) * 0.075,
      cos(t * 0.83) * 0.09,
      sin(t * 1.27) * 0.065
    ) * uDrift;

    // Optional pull toward the origin, used when a cloud is being drawn into
    // an object that is assembling.
    vec3 local = mix(position, position * 0.18, uConverge) + drift;

    vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);
    vFogDepth = -mvPosition.z;

    // Perspective-correct sizing, so motes near the camera read larger.
    gl_PointSize = uSize * aScale * uPixelRatio * (140.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vScale = aScale;
  }
`;

export const motesFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  uniform float uReveal;
  uniform float uFogDensity;

  varying float vScale;
  varying float vFogDepth;

  void main() {
    // Soft round falloff. A hard-edged square point is instantly readable as a
    // sprite; the smoothstep is what makes it read as a defocused speck.
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.06, d);

    float f = vFogDepth * uFogDensity;
    float fogAmount = 1.0 - clamp(1.0 - exp(-f * f), 0.0, 1.0);

    gl_FragColor = vec4(uColor * alpha * vScale * uReveal * 0.85 * fogAmount, 1.0);
  }
`;
