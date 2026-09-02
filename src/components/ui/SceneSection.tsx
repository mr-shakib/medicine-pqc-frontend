'use client';

import { accent } from '@/lib/design/tokens';
import { sceneWeight, type SceneDefinition } from '@/lib/scenes';

export interface SceneSectionProps {
  definition: SceneDefinition;
  /** The first section carries the page's h1 and a scroll cue. */
  isFirst: boolean;
  isLast: boolean;
}

/**
 * One chapter of the scroll spine.
 *
 * The section is as tall as the chapter's scroll weight, and its content sits
 * in a sticky full-viewport frame -- so a two-viewport chapter holds its copy
 * on screen for the whole of its length instead of letting it drift off. For a
 * single-weight chapter this behaves identically to static positioning.
 *
 * Copy is deliberately sparse: the object floating behind is the subject, and
 * this annotates it the way a caption annotates a product photograph.
 */
export default function SceneSection({
  definition,
  isFirst,
  isLast,
}: SceneSectionProps) {
  const Heading = isFirst ? 'h1' : 'h2';
  const accentColor = accent[definition.accent].light;
  const weight = sceneWeight(definition.index);

  const titleLines = definition.title.split('\n');

  return (
    <section
      id={definition.id}
      data-scene={definition.index}
      aria-label={definition.title.replace(/\n/g, ' ')}
      style={{ height: `${weight * 100}vh` }}
      className="relative w-full"
    >
      <div className="sticky top-0 flex h-screen w-full items-end px-6 pb-28 sm:items-center sm:px-12 sm:pb-0 lg:px-20">
        <div className="pointer-events-none max-w-[34rem]">
          {/* Chapter marker: a hairline rule, the index, the label. */}
          <div
            className={`mb-6 flex items-center gap-3 ${isFirst ? "enter enter-delay-1" : ""}`}
          >
            <span
              className="block h-px w-8 transition-colors duration-700"
              style={{ backgroundColor: accentColor }}
            />
            <p className="eyebrow" style={{ color: accentColor }}>
              {String(definition.index + 1).padStart(2, '0')} /{' '}
              {definition.label}
            </p>
          </div>

          <Heading
            className={[
              definition.statement
                ? 'statement'
                : isFirst
                  ? 'display-xl'
                  : 'display-l',
              isFirst ? 'enter enter-delay-2' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {titleLines.map((line, i) => (
              <span key={i} className="block">
                {line}
                {/*
                  The lines are block-level, so they already sit on separate
                  rows — but without whitespace between them the heading's
                  ACCESSIBLE name concatenates into "Every medicinehas an
                  identity". The space is invisible and the reading is correct.
                */}
                {i < titleLines.length - 1 ? ' ' : null}
              </span>
            ))}
          </Heading>

          {definition.subtitle ? (
            <p className="lead mt-6">{definition.subtitle}</p>
          ) : null}

          {definition.body ? (
            <p className="body-copy mt-5 max-w-[30rem]">{definition.body}</p>
          ) : null}

          {isFirst ? (
            <p className="eyebrow enter enter-delay-3 mt-14 text-n09">
              Scroll to begin
            </p>
          ) : null}

          {isLast ? (
            <p className="eyebrow mt-12 text-n09">Continue below</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
