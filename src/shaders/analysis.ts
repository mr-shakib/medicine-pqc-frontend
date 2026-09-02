/**
 * AI analysis visuals.
 *
 * Two programs: the sweeping scan plane, and the per-product signature trace
 * that carries the verdict.
 *
 * The traces are the whole idea. "Authentic" and "counterfeit" are conveyed by
 * the SHAPE of a signal — steady and continuous, or erratic and broken — rather
 * than by a readout. A number needs to be read and believed; a broken line is
 * understood before it is read, which is what the brief asks for and what keeps
 * this from becoming an interface.
 */

export const scanPlaneVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const scanPlaneFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    // A soft band with a bright core, fading to nothing at the edges of the
    // plane so it reads as a volume of light rather than a lit rectangle.
    float across = abs(vUv.y - 0.5) * 2.0;
    float band = pow(max(1.0 - across, 0.0), 2.4);

    float edge = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0);

    gl_FragColor = vec4(uColor * band * edge * uOpacity, 1.0);
  }
`;

/* -------------------------------------------------------------------------- */
/* Signature traces                                                            */
/* -------------------------------------------------------------------------- */

export const signatureVertex = /* glsl */ `
  attribute float aAuthentic;
  attribute float aSeed;
  attribute float aHeight;

  uniform float uScanY;
  uniform float uReveal;

  varying vec2 vUv;
  varying float vAuthentic;
  varying float vSeed;
  varying float vShown;

  void main() {
    vUv = uv;
    vAuthentic = aAuthentic;
    vSeed = aSeed;

    /*
      Each trace reveals itself when the sweep passes ITS OWN height. Comparing
      the instance's world height against the scan plane in the shader means the
      staggered, row-by-row reveal costs nothing on the CPU and stays an exact
      function of scroll.
    */
    vShown = smoothstep(aHeight - 0.05, aHeight + 0.35, uScanY) * uReveal;

    vec4 mvPosition =
      modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const signatureFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uAuthenticColor;
  uniform vec3 uCounterfeitColor;
  uniform float uTime;

  varying vec2 vUv;
  varying float vAuthentic;
  varying float vSeed;
  varying float vShown;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
  }

  void main() {
    if (vShown < 0.01) discard;

    float x = vUv.x;

    /*
      Authentic: a steady, low-amplitude periodic trace. Continuous, even, and
      unremarkable -- which is exactly the point. A verified result should look
      like nothing is wrong.
    */
    float clean = sin(x * 26.0 + uTime * 1.4) * 0.055;

    /*
      Counterfeit: the same trace, broken. Irregular amplitude, an unstable
      baseline and intermittent dropouts. No glitch effects and no noise for its
      own sake -- it is recognisably the SAME measurement, failing.
    */
    float step1 = hash11(floor(x * 22.0) + vSeed * 17.0) - 0.5;
    float step2 = hash11(floor(x * 7.0) - vSeed * 5.0) - 0.5;
    float broken = step1 * 0.24 + step2 * 0.12 +
      sin(x * 31.0 + uTime * 2.6) * 0.04;

    float dropout = step(0.22, hash11(floor(x * 12.0) + vSeed * 3.0 +
      floor(uTime * 2.0) * 0.37));

    float wave = mix(broken, clean, vAuthentic);
    float alive = mix(dropout, 1.0, vAuthentic);

    float d = abs(vUv.y - (0.5 + wave));
    float line = smoothstep(0.05, 0.008, d) * alive;

    // A dim baseline rule, so an empty stretch still reads as a channel with
    // nothing in it rather than as absent geometry.
    float rule = smoothstep(0.012, 0.0, abs(vUv.y - 0.5)) * 0.16;

    vec3 color = mix(uCounterfeitColor, uAuthenticColor, vAuthentic);
    float alpha = max(line, rule) * vShown;

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * alpha, 1.0);
  }
`;
