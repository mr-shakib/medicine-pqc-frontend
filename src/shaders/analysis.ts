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

    float out_ = band * edge * uOpacity;
    gl_FragColor = vec4(uColor * out_, out_);
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
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

/* -------------------------------------------------------------------------- */
/* Feature extraction                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Points lifting off a product and streaming into its signature trace.
 *
 * This is the step the chapter was asserting rather than showing. A sweep
 * passed over a product and a verdict appeared; nothing depicted the reading
 * itself. Here each particle leaves the surface as the scan reaches it, arcs
 * down to that product's trace, and lands — so the trace is visibly made OUT OF
 * the object rather than merely displayed beneath it.
 *
 * One draw call for every product in the field.
 */
export const featureVertex = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aItemY;
  attribute float aSeed;
  attribute float aAuthentic;

  uniform float uScanY;
  uniform float uReveal;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vAuthentic;

  void main() {
    // Each particle is driven by the sweep reaching ITS OWN product, so the
    // whole field staggers itself with no per-item work on the CPU.
    // A generous window. Narrower, the extraction for a given row begins and
    // finishes inside a fraction of the sweep and is over before it registers.
    float reach = smoothstep(aItemY - 0.55, aItemY + 1.05, uScanY);

    // A short per-particle delay, so features leave the surface in a stream
    // rather than all at once.
    float t = clamp((reach - aSeed * 0.35) / 0.65, 0.0, 1.0);
    float eased = t * t * (3.0 - 2.0 * t);

    vec3 p = mix(position, aTarget, eased);

    // Arc outward on the way down: a straight line reads as a wipe, a curve
    // reads as something being carried.
    float arc = sin(eased * 3.14159265);
    p.x += arc * (aSeed - 0.5) * 0.5;
    p.z += arc * 0.25;
    p.y += arc * 0.12;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPixelRatio * (150.0 / -mv.z) * (0.6 + aSeed * 0.6);
    gl_Position = projectionMatrix * mv;

    // Present while in flight only: fully arrived features have become the
    // trace, and leaving them lit would clutter the verdict.
    vAlpha = sin(eased * 3.14159265) * uReveal;
    vAuthentic = aAuthentic;
  }
`;

export const featureFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  uniform vec3 uCounterfeitColor;

  varying float vAlpha;
  varying float vAuthentic;

  void main() {
    if (vAlpha < 0.01) discard;
    float d = length(gl_PointCoord - 0.5);
    float dot_ = smoothstep(0.5, 0.1, d);
    vec3 color = mix(uCounterfeitColor, uColor, vAuthentic);
    float out_ = dot_ * vAlpha * 0.9;
    gl_FragColor = vec4(color * out_, out_);
  }
`;
