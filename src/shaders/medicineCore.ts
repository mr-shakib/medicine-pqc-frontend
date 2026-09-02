/**
 * Shaders for the medicine core — the opening hero object.
 *
 * The crystalline shell: a surface that appears lit from within. Written to be
 * revealed from total darkness by a single `uReveal` uniform, so the scroll
 * timeline drives it with one value and reverses perfectly.
 *
 * The suspended motes live in `shaders/motes`, shared with the capsule
 * formation.
 */

/* -------------------------------------------------------------------------- */
/* Crystalline shell                                                           */
/* -------------------------------------------------------------------------- */

export const coreShellVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying float vFogDepth;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPos = position;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    vFogDepth = -mvPosition.z;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Exponential-squared fog, applied MULTIPLICATIVELY.
 *
 * Three's stock `fog_fragment` chunk mixes toward the fog colour, which is
 * correct for opaque surfaces and wrong for additive ones -- an additive
 * surface has to fade toward *zero contribution*, not toward a colour. Scaling
 * the result by the inverse fog factor is the additive-correct form.
 */
const FOG_CHUNK = /* glsl */ `
  uniform float uFogDensity;
  varying float vFogDepth;

  vec3 applyFog(vec3 color) {
    float f = vFogDepth * uFogDensity;
    return color * (1.0 - clamp(1.0 - exp(-f * f), 0.0, 1.0));
  }
`;

export const coreShellFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uRimColor;
  uniform vec3 uGlowColor;
  uniform float uTime;
  uniform float uReveal;
  uniform float uRimPower;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;

  ${FOG_CHUNK}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vViewDir);

    /*
      Back faces must have their normal flipped before the facing ratio is
      taken. Their interpolated normal points AWAY from the camera, so the dot
      product goes negative, clamps to zero, and the facing ratio saturates at
      1 -- meaning every back-facing pixel would render at full rim intensity
      and fill the silhouette with a flat disc of colour. Flipping restores the
      real geometry and lets front and back accumulate into actual volume.
    */
    if (!gl_FrontFacing) {
      normal = -normal;
    }

    // Facing ratio. Near 0 head-on, near 1 at the silhouette.
    float facing = 1.0 - clamp(dot(normal, view), 0.0, 1.0);

    // The rim: a thin bright band at the silhouette. This is what makes a
    // transparent shell read as a solid surface rather than a coloured fog.
    float rim = pow(facing, uRimPower);

    // The inverse term concentrates toward the centre of the silhouette, so
    // light appears to be escaping from inside the object rather than coating
    // its surface.
    float interior = pow(1.0 - facing, 2.4);

    // Crystalline striations. Two interfering frequencies at different speeds,
    // so the banding never resolves into an obvious repeating pattern.
    float striation =
      sin(vLocalPos.y * 21.0 + uTime * 0.28) *
      sin(vLocalPos.x * 13.0 - uTime * 0.19);
    striation = smoothstep(0.25, 0.95, striation * 0.5 + 0.5) * 0.14;

    /*
      Intensities are deliberately low. This material renders DoubleSide, so
      every pixel accumulates the back face and the front face, and the core
      stacks two of these shells -- four contributions in total before the
      nucleus is even drawn. Values tuned to look right on a single pass blow
      the whole object out into a flat opaque ball.
    */
    vec3 color =
      uRimColor * rim * 0.3 +
      uGlowColor * interior * 0.032 +
      uRimColor * striation * 0.45;

    // Additive: alpha is carried in the colour, so the reveal is a straight
    // multiply and darkness is genuinely zero contribution.
    gl_FragColor = vec4(applyFog(color * uReveal), 1.0);
  }
`;
