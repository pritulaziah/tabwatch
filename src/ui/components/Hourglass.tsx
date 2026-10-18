import { useEffect, useRef } from 'react';

/** Full cycle of the sand fall: the bulb empties in one minute. */
const CYCLE_MS = 60_000;

/** Canvas side in pixels. CSS sets the actual size of the element. */
const SIZE = 24;

/** Top bulb: from the wide mouth to the narrow neck. */
function topBulb(context: CanvasRenderingContext2D): void {
  context.beginPath();
  context.moveTo(4, 3);
  context.lineTo(20, 3);
  context.quadraticCurveTo(20, 9, 12, 12);
  context.quadraticCurveTo(4, 9, 4, 3);
  context.closePath();
}

/** Bottom bulb: the mirror of the top bulb. */
function bottomBulb(context: CanvasRenderingContext2D): void {
  context.beginPath();
  context.moveTo(4, 21);
  context.lineTo(20, 21);
  context.quadraticCurveTo(20, 15, 12, 12);
  context.quadraticCurveTo(4, 15, 4, 21);
  context.closePath();
}

/**
 * Hourglass on canvas: paths draw the silhouette and the sand. There are
 * no assets and no dependencies. The sand falls while the tracking runs
 * and stops without it. The color comes from `currentColor`, so the
 * hourglass follows the theme.
 */
export function Hourglass({ running, className }: { running: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Level of the sand: it survives the stop and the start of tracking. */
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const context = canvas.getContext('2d');
    // Without a context there is nothing to draw with. The empty canvas
    // stays and no exception occurs.
    if (context === null) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    canvas.width = SIZE * ratio;
    canvas.height = SIZE * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const draw = (progress: number, streaming: boolean): void => {
      const color = getComputedStyle(canvas).color;
      context.clearRect(0, 0, SIZE, SIZE);
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 1.5;

      // Sand in the top bulb: the level goes down to the neck.
      const topSurface = 3 + 9 * progress;
      context.save();
      topBulb(context);
      context.clip();
      context.fillRect(4, topSurface, 16, 12 - topSurface);
      context.restore();

      // Sand in the bottom bulb: the pile grows from the bottom.
      const bottomSurface = 21 - 9 * progress;
      context.save();
      bottomBulb(context);
      context.clip();
      context.fillRect(4, bottomSurface, 16, 21 - bottomSurface);
      context.restore();

      // The stream exists only while the tracking runs.
      if (streaming) {
        context.beginPath();
        context.moveTo(12, 12);
        context.lineTo(12, bottomSurface);
        context.stroke();
      }

      topBulb(context);
      context.stroke();
      bottomBulb(context);
      context.stroke();
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      draw(0, running);
      return;
    }

    if (!running) {
      // Tracking is off: the sand holds its level and no frame is
      // requested. The effect runs again when the tracking starts.
      draw(phaseRef.current / CYCLE_MS, false);
      return;
    }

    // The first frame is drawn at once. The popup does not wait for the
    // animation to show the sand.
    draw(phaseRef.current / CYCLE_MS, true);

    let previous = performance.now();
    let frame = 0;
    const tick = (time: number): void => {
      phaseRef.current = (phaseRef.current + (time - previous)) % CYCLE_MS;
      previous = time;
      draw(phaseRef.current / CYCLE_MS, true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
