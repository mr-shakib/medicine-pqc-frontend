/**
 * The cinematic grade: a vignette plus top and bottom scrims, sitting between
 * the canvas and the copy.
 *
 * This does two jobs at once. It focuses the eye centre-frame the way a real
 * lens does, and it guarantees a contrast floor under the typography whatever
 * the 3D layer happens to be rendering behind it -- which is what makes light
 * text safe over a live scene without resorting to solid plates.
 */
export default function Grade() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[5]"
      aria-hidden="true"
    >
      <div className="grade-vignette absolute inset-0" />
      <div className="grade-scrim-top absolute inset-x-0 top-0 h-32" />
      <div className="grade-scrim-bottom absolute inset-x-0 bottom-0 h-48" />
    </div>
  );
}
