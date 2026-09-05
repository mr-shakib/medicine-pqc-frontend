import { SCENES } from '@/lib/scenes';

/**
 * The no-WebGL / boot-state ground.
 *
 * A real rendering of the same chamber using CSS gradients: the identical
 * vertical falloff and accent pools the backdrop shader paints, so the page has
 * the right atmosphere before WebGL starts and keeps it if WebGL never does.
 *
 * Painted from custom properties rather than from the token module, which is
 * what lets a SERVER component be theme-correct at all: the values are resolved
 * by the browser against whatever `data-theme` the head script settled on, so
 * there is nothing here for the server to guess wrong and nothing to re-render
 * when the theme changes.
 */
export default function StaticFallback() {
  return (
    <div
      className="fixed inset-0 z-0"
      aria-hidden="true"
      style={{
        background:
          'linear-gradient(180deg, var(--color-n00) 0%, var(--color-n02) 46%, var(--color-n01) 100%)',
      }}
    >
      {SCENES.map((scene, i) => (
        <div
          key={scene.id}
          className="absolute rounded-full"
          style={{
            background: `radial-gradient(circle, var(--color-${scene.accent}) 0%, transparent 68%)`,
            opacity: 0.07,
            width: '52vmin',
            height: '38vmin',
            right: `${6 + (i % 3) * 14}%`,
            top: `${10 + (i % 4) * 19}%`,
          }}
        />
      ))}
    </div>
  );
}
