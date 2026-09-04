import { SCENES } from '@/lib/scenes';
import { accent, neutral } from '@/lib/design/tokens';

/**
 * The no-WebGL / boot-state ground.
 *
 * A real rendering of the same chamber using CSS gradients: the identical
 * vertical falloff and accent pools the backdrop shader paints, so the page has
 * the right atmosphere before WebGL starts and keeps it if WebGL never does.
 */
export default function StaticFallback() {
  return (
    <div
      className="fixed inset-0 z-0"
      aria-hidden="true"
      style={{
        background: `linear-gradient(180deg, ${neutral.n00} 0%, ${neutral.n02} 46%, ${neutral.n01} 100%)`,
      }}
    >
      {SCENES.map((scene, i) => (
        <div
          key={scene.id}
          className="absolute rounded-full"
          style={{
            background: `radial-gradient(circle, ${accent[scene.accent].base} 0%, transparent 68%)`,
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
