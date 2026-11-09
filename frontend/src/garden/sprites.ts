import type { VisualPlant } from "./layout";
const PX = 4;
export function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x / PX) * PX,
    Math.round(y / PX) * PX,
    Math.max(PX, Math.round(w / PX) * PX),
    Math.max(PX, Math.round(h / PX) * PX),
  );
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
export function drawPlant(ctx: CanvasRenderingContext2D, plant: VisualPlant, time: number, growth: number, index: number) {
      const sway = Math.round(Math.sin(time * 0.0014 + plant.x) * (plant.stage + 1));
      const { x, y, stage, variant } = plant;
      const delay = index * 0.018;
      const reveal = Math.max(0, Math.min(1, (growth - delay) / 0.42));
      if (!reveal) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.25 + reveal * 0.75, 0.25 + reveal * 0.75);
      ctx.translate(-x, -y);
      ellipse(ctx, x + 5, y + 4, 22 + stage * 5, 7 + stage, "rgba(19,71,45,.34)");
      if (stage === 0) {
        drawPixel(ctx, x, y - 20, 4, 22, "#277647");
        drawPixel(ctx, x - 12 + sway, y - 19, 12, 8, "#53bd54");
        drawPixel(ctx, x + 4 + sway, y - 28, 14, 10, "#8ce65e");
        drawPixel(ctx, x + 8 + sway, y - 30, 5, 4, "#d8fa83");
      } else if (stage === 1) {
        drawPixel(ctx, x, y - 43, 5, 45, "#286e41");
        drawPixel(ctx, x - 21 + sway, y - 29, 21, 12, "#2e9b51");
        drawPixel(ctx, x - 16 + sway, y - 36, 14, 8, "#70d855");
        drawPixel(ctx, x + 4 + sway, y - 25, 25, 12, "#47b64f");
        drawPixel(ctx, x + 10 + sway, y - 34, 14, 9, "#a0e95c");
        drawPixel(ctx, x - 8 + sway, y - 51, 20, 13, "#58c650");
        drawPixel(ctx, x - 3 + sway, y - 57, 10, 7, variant === 2 ? "#ffd35c" : "#baf36d");
      } else {
        const mature = stage === 3;
        const height = mature ? (variant === 1 ? 132 : 116) : variant === 1 ? 98 : 84;
        const size = mature ? 1 : 0.76;
        const palettes = [
          ["#155d42", "#1f8246", "#49b94a", "#a3e95e"],
          ["#174f47", "#1c7254", "#369c63", "#82d978"],
          ["#315d3b", "#417e41", "#6db64b", "#b9e267"],
        ];
        const [deep, dark, leaf, light] = palettes[variant];
        drawPixel(ctx, x - 8, y - height + 34, 16, height - 30, "#68422e");
        drawPixel(ctx, x, y - height + 39, 8, height - 40, "#a86a3c");
        drawPixel(ctx, x - 4, y - 35, 4, 12, "#d08a48");
        drawPixel(ctx, x - 23, y - height + 59, 25, 7, "#765038");
        drawPixel(ctx, x + 4, y - height + 49, 25, 7, "#765038");

        if (variant === 0) {
          // Broad old-growth oak: scalloped crown, small gaps, and sunlit upper leaves.
          const crown: [number, number, number, number, string][] = [
            [-43, 3, 61, 24, deep],
            [4, 0, 54, 26, dark],
            [-53, -18, 42, 27, dark],
            [27, -22, 39, 28, deep],
            [-30, -39, 43, 30, leaf],
            [3, -45, 45, 34, leaf],
            [-11, -63, 36, 25, light],
          ];
          crown.forEach(([dx, dy, width, heightPx, color]) =>
            drawPixel(
              ctx,
              x + dx * size + sway,
              y - height + dy * size,
              width * size,
              heightPx * size,
              color,
            ),
          );
          drawPixel(ctx, x - 38 + sway, y - height - 30 * size, 12, 8, light);
          drawPixel(ctx, x + 34 + sway, y - height - 19 * size, 12, 8, "#72ce51");
          drawPixel(ctx, x - 7 + sway, y - height - 8, 9, 8, "#164d3a");
        } else if (variant === 1) {
          // Tall cedar: stepped asymmetric boughs create a completely different silhouette.
          const tiers: [number, number, number, string][] = [
            [-9, -72, 22, light],
            [-18, -57, 39, leaf],
            [-27, -39, 58, dark],
            [-36, -19, 76, leaf],
            [-44, 3, 90, deep],
          ];
          tiers.forEach(([dx, dy, width, color], index) => {
            drawPixel(ctx, x + dx * size + sway, y - height + dy * size, width * size, 13, color);
            drawPixel(
              ctx,
              x + (dx + 8) * size + sway,
              y - height + (dy - 9) * size,
              (width - 16) * size,
              12,
              index % 2 ? dark : leaf,
            );
          });
          drawPixel(ctx, x - 4 + sway, y - height - 82 * size, 9, 15, light);
          drawPixel(ctx, x - 31 + sway, y - height - 9, 10, 8, "#5dc06b");
        } else {
          // Willow: high rounded canopy with long, animated curtains of foliage.
          drawPixel(ctx, x - 39 * size + sway, y - height - 25, 78 * size, 28, dark);
          drawPixel(ctx, x - 29 * size + sway, y - height - 43, 58 * size, 25, leaf);
          drawPixel(ctx, x - 13 * size + sway, y - height - 55, 31 * size, 18, light);
          drawPixel(ctx, x - 48 * size + sway, y - height - 9, 24 * size, 26, deep);
          drawPixel(ctx, x + 27 * size + sway, y - height - 7, 24 * size, 30, deep);
          drawPixel(ctx, x - 44 * size + sway, y - height + 14, 9, 38 * size, dark);
          drawPixel(ctx, x - 29 * size + sway, y - height + 8, 8, 48 * size, leaf);
          drawPixel(ctx, x + 29 * size + sway, y - height + 13, 8, 43 * size, leaf);
          drawPixel(ctx, x + 43 * size + sway, y - height + 4, 8, 37 * size, dark);
          drawPixel(ctx, x - 6 + sway, y - height - 26, 10, 8, "#d2ec78");
        }
        if (mature) {
          const fruit = variant === 2 ? "#ffd05c" : variant === 1 ? "#f58bb8" : "#ff775e";
          drawPixel(ctx, x - 30 + sway, y - height - 5, 7, 7, fruit);
          drawPixel(ctx, x + 25 + sway, y - height - 17, 7, 7, fruit);
          drawPixel(ctx, x + 4 + sway, y - height + 12, 7, 7, fruit);
        }
      }
      ctx.restore();
    }
