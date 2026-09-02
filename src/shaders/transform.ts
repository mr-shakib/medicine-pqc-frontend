/**
 * Transformation particles.
 *
 * One `Points` draw call carries the entire capsule-to-tablet morph. Every
 * particle knows where it starts and where it ends, and all of its motion --
 * stagger, spiral, radial bulge, lift -- is derived in the vertex stage from a
 * single scroll-driven uniform.
 *
 * Nothing is animated on the CPU. That is what makes tens of thousands of
 * particles cost the same as one object, and it is also what makes the whole
 * sequence exactly reversible: position is a pure function of `uProgress`, with
 * no accumulated state anywhere.
 */

export const transformVertex = /* glsl */ `
  attribute vec3 aTarget;
  attribute vec3 aWaypoint;
  attribute float aSeed;
  attribute float aDelay;
  attribute float aSwirl;
  attribute float aBulge;
  attribute float aCipher;

  uniform float uProgress;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;
  uniform float uCipherAmount;
  uniform float uSpread;
  uniform float uSwirlStrength;
  uniform float uDriftAmount;
  uniform float uTime;

  varying float vSeed;
  varying float vCipher;
  varying float vFade;
  varying float vFogDepth;

  void main() {
    /*
      Per-particle stagger. Without it every particle departs and lands on the
      same frame, which reads as one object sliding rather than as material
      coming apart. uSpread is how much of the timeline is given over to the
      offset; the remainder is each particle's own flight.
    */
    float span = max(1.0 - uSpread, 0.0001);
    float t = clamp((uProgress - aDelay * uSpread) / span, 0.0, 1.0);
    float eased = t * t * (3.0 - 2.0 * t);

    /*
      Quadratic Bezier through the waypoint.

      The control point is corrected so the curve passes exactly THROUGH the
      waypoint at the midpoint rather than merely being pulled toward it.

      When no waypoint is supplied the caller fills the attribute with the plain
      midpoint of source and target, and the algebra collapses the whole
      expression back to a straight interpolation — so a chapter that wants a
      direct morph pays nothing and needs no branch.
    */
    vec3 control = 2.0 * aWaypoint - 0.5 * (position + aTarget);
    float inv = 1.0 - eased;
    vec3 p =
      inv * inv * position +
      2.0 * inv * eased * control +
      eased * eased * aTarget;

    // Peaks at mid-flight, zero at both ends -- so every deviation below
    // vanishes exactly when the particle is on a surface.
    float arc = sin(eased * 3.14159265);

    // Spiral about the vertical axis.
    float angle = aSwirl * arc * uSwirlStrength;
    float s = sin(angle);
    float c = cos(angle);
    p.xz = mat2(c, -s, s, c) * p.xz;

    // Radial expansion and lift, so the cloud opens out before it resolves.
    p.xz *= 1.0 + arc * aBulge;
    p.y += arc * aSwirl * 0.42;

    /*
      A little drift, so a held mid-transition frame is never quite static.

      Tunable because it competes directly with any structure in the path: if
      the drift is the same order as the spacing of a lattice waypoint, it
      dissolves exactly the pattern that waypoint exists to show.
    */
    p += arc * uDriftAmount * vec3(
      sin(uTime * 0.6 + aSeed * 31.0),
      cos(uTime * 0.5 + aSeed * 17.0),
      sin(uTime * 0.7 + aSeed * 23.0)
    );

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vFogDepth = -mvPosition.z;

    gl_PointSize =
      uSize * uPixelRatio * (140.0 / -mvPosition.z) * (0.55 + aSeed * 0.75);
    gl_Position = projectionMatrix * mvPosition;

    vSeed = aSeed;
    // Cipher glyphs only exist in flight: on a surface a particle is material,
    // not data.
    vCipher = aCipher * uCipherAmount * arc;
    vFade = uOpacity;
  }
`;

export const transformFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uCipherColor;
  uniform float uFogDensity;

  varying float vSeed;
  varying float vCipher;
  varying float vFade;
  varying float vFogDepth;

  /**
   * Hash without sine. The usual fract(sin(dot(p,k)) * 43758.5) degrades
   * into visible structure at anything below highp, and this is drawn at
   * per-pixel granularity inside a point sprite where structure would read as
   * a repeating pattern across every particle.
   */
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = gl_PointCoord;
    vec2 centred = uv - 0.5;

    // Resting form: a soft, defocused mote.
    float mote = smoothstep(0.5, 0.06, length(centred));

    /*
      In-flight form: a 4x4 bit block seeded per particle, reading as a fragment
      of ciphertext. Drawn procedurally inside the existing sprite rather than
      from an atlas -- it costs a hash per pixel and no extra geometry, texture
      or draw call.
    */
    vec2 cell = floor(uv * 4.0);
    float bit = step(0.52, hash21(cell + vSeed * 37.0));
    float frame =
      step(abs(centred.x), 0.44) * step(abs(centred.y), 0.44);
    float glyph = bit * frame;

    float shape = mix(mote, glyph, vCipher);
    vec3 color = mix(uColor, uCipherColor, vCipher);

    float f = vFogDepth * uFogDensity;
    float fogAmount = 1.0 - clamp(1.0 - exp(-f * f), 0.0, 1.0);

    float alpha = shape * vFade * fogAmount;
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(color * alpha, 1.0);
  }
`;
