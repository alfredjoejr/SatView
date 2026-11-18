/** Helpers for drawing az/el "sky plots" (zenith at the center, horizon at the edge). */

export interface PolarFrame {
  cx: number;
  cy: number;
  /** Radius of the horizon circle in CSS pixels. */
  r: number;
}

const DEG = Math.PI / 180;

/** Radius for an elevation (90° → center, 0° → edge). */
export function elevationRadius(frame: PolarFrame, elDeg: number): number {
  return (frame.r * (90 - Math.max(0, Math.min(90, elDeg)))) / 90;
}

export function polarToXY(frame: PolarFrame, azDeg: number, elDeg: number): { x: number; y: number } {
  const rr = elevationRadius(frame, elDeg);
  const a = azDeg * DEG;
  return { x: frame.cx + rr * Math.sin(a), y: frame.cy - rr * Math.cos(a) };
}

/** Prepare a canvas for crisp rendering on high-DPI screens. */
export function setupHiDpiCanvas(canvas: HTMLCanvasElement, cssSize: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawPolarGrid(ctx: CanvasRenderingContext2D, frame: PolarFrame): void {
  const { cx, cy, r } = frame;

  ctx.fillStyle = 'rgba(10, 25, 45, 0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(143, 184, 222, 0.25)';
  ctx.lineWidth = 1;
  for (const el of [0, 30, 60]) {
    ctx.beginPath();
    ctx.arc(cx, cy, elevationRadius(frame, el), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let az = 0; az < 360; az += 30) {
    const edge = polarToXY(frame, az, 0);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(edge.x, edge.y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(220, 235, 250, 0.85)';
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels: [string, number][] = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  for (const [label, az] of labels) {
    const a = az * DEG;
    ctx.fillText(label, cx + (r + 10) * Math.sin(a), cy - (r + 10) * Math.cos(a));
  }

  ctx.fillStyle = 'rgba(143, 184, 222, 0.6)';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.fillText('60°', cx + 4, cy - elevationRadius(frame, 60) + 7);
  ctx.fillText('30°', cx + 4, cy - elevationRadius(frame, 30) + 7);
}

/** Fill an annular wedge between two azimuths and two elevations. */
export function fillSector(
  ctx: CanvasRenderingContext2D,
  frame: PolarFrame,
  startAz: number,
  endAz: number,
  minEl: number,
  maxEl: number,
  style: string,
): void {
  const a0 = (startAz - 90) * DEG;
  const a1 = (endAz - 90) * DEG;
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.arc(frame.cx, frame.cy, elevationRadius(frame, minEl), a0, a1);
  ctx.arc(frame.cx, frame.cy, elevationRadius(frame, maxEl), a1, a0, true);
  ctx.closePath();
  ctx.fill();
}

export function strokeElevationRing(
  ctx: CanvasRenderingContext2D,
  frame: PolarFrame,
  elDeg: number,
  style: string,
): void {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = style;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(frame.cx, frame.cy, elevationRadius(frame, elDeg), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
