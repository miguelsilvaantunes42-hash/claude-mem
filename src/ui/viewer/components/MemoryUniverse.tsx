import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FeedItem } from '../types';
import { labelForCategory } from '../utils/category';
import { sessionKey, sessionRefOf } from '../utils/sessions';

interface MemoryUniverseProps {
  /** Newest first, as the feed renders them. */
  items: FeedItem[];
  /** True while older pages exist, so the sky is only the loaded part. */
  isPartial?: boolean;
}

const DEFAULT_WIDTH = 720;
const HEIGHT = 176;
const PAD_X = 24;
const PAD_Y = 24;
/** Above this many loaded memories, only the newest are drawn. */
const MAX_STARS = 400;

interface Star {
  key: string;
  anchor: string;
  x: number;
  y: number;
  r: number;
  kind: FeedItem['itemType'];
  label: string;
  session: string | null;
  time: number;
}

/** Deterministic 0..1 from an id, so a memory keeps its place in the sky. */
function scatter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function starLabel(item: FeedItem): string {
  if (item.itemType === 'observation') return `${labelForCategory(item.type)}: ${item.title || 'Untitled observation'}`;
  if (item.itemType === 'summary') return `Session summary: ${item.request || 'Untitled session'}`;
  const text = item.prompt_text.replace(/\s+/g, ' ').trim();
  return `Prompt: ${text.length > 80 ? `${text.slice(0, 79)}…` : text}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function memoryAnchorId(item: Pick<FeedItem, 'itemType' | 'id'>): string {
  return `memory-${item.itemType}-${item.id}`;
}

/**
 * The memory universe: every loaded memory is a star placed by time (oldest
 * left, newest right), coloured by kind, with faint lines joining memories of
 * the same session. Selecting a star scrolls to its card.
 */
export function MemoryUniverse({ items, isPartial = false }: MemoryUniverseProps) {
  const [active, setActive] = useState<Star | null>(null);
  // Drawn at the sky's real pixel width so stars stay round at every size.
  const skyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = skyRef.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [items.length === 0]);

  const { stars, constellations, counts } = useMemo(() => {
    const shown = items.slice(0, MAX_STARS);
    const times = shown.map(item => item.created_at_epoch);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(max - min, 1);
    const counts = { observation: 0, summary: 0, prompt: 0 };

    const stars: Star[] = shown.map(item => {
      counts[item.itemType]++;
      const seed = `${item.itemType}-${item.id}`;
      const t = shown.length === 1 ? 0.5 : (item.created_at_epoch - min) / span;
      const session = sessionRefOf(item);
      return {
        key: seed,
        anchor: memoryAnchorId(item),
        x: PAD_X + t * (width - PAD_X * 2) + (scatter(`${seed}x`) - 0.5) * 12,
        y: PAD_Y + scatter(seed) * (HEIGHT - PAD_Y * 2),
        r: item.itemType === 'summary' ? 5 : item.itemType === 'prompt' ? 3.5 : 2.5,
        kind: item.itemType,
        label: starLabel(item),
        session: session ? sessionKey(session) : null,
        time: item.created_at_epoch,
      };
    });

    const bySession = new Map<string, Star[]>();
    for (const star of stars) {
      if (!star.session) continue;
      const group = bySession.get(star.session) ?? [];
      group.push(star);
      bySession.set(star.session, group);
    }
    const constellations = [...bySession.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([session, group]) => ({
        session,
        points: [...group].sort((a, b) => a.time - b.time).map(star => `${star.x.toFixed(1)},${star.y.toFixed(1)}`).join(' '),
      }));

    return { stars, constellations, counts };
  }, [items, width]);

  if (items.length === 0) return null;

  const goTo = (star: Star) => {
    const card = document.getElementById(star.anchor);
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    card.focus({ preventScroll: true });
  };

  const total = counts.observation + counts.summary + counts.prompt;
  const summary = `${total}${isPartial ? '+' : ''} memories: ${counts.observation} observations, ${counts.summary} summaries, ${counts.prompt} prompts`;

  return (
    <figure className="universe">
      <div className="universe-sky-frame" ref={skyRef}>
      <svg
        className="universe-sky"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Memory universe. ${summary}. Oldest on the left, newest on the right.`}
        onMouseLeave={() => setActive(null)}
      >
        {constellations.map(c => (
          <polyline key={c.session} className="universe-constellation" points={c.points} />
        ))}
        {stars.map(star => (
          <circle
            key={star.key}
            className={`universe-star universe-star--${star.kind}${active?.key === star.key ? ' is-active' : ''}`}
            cx={star.x}
            cy={star.y}
            r={star.r}
            onMouseEnter={() => setActive(star)}
            onClick={() => goTo(star)}
          />
        ))}
      </svg>
      </div>
      <figcaption className="universe-caption">
        <span className="universe-focus" aria-live="polite">
          {active ? active.label : 'Each star is a memory Claude stored. Lines join memories from the same session; select a star to jump to it.'}
        </span>
        <span className="universe-legend">
          <span className="universe-key universe-key--observation">{plural(counts.observation, 'observation')}</span>
          <span className="universe-key universe-key--summary">{counts.summary === 1 ? '1 summary' : `${counts.summary} summaries`}</span>
          <span className="universe-key universe-key--prompt">{plural(counts.prompt, 'prompt')}</span>
        </span>
      </figcaption>
    </figure>
  );
}
