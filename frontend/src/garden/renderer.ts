import type { GardenData } from '../types';
import { W, H, hashText, seededRandom, mapPlant, mapFlowers, type VisualPlant as Plant, type HoveredPlant } from './layout';
import { drawPixel, drawPlant } from './sprites';

export function plantHeight(plant: Plant): number {
  if (plant.stage < 2) return plant.stage === 1 ? 64 : 36;
  if (plant.variant === 1) return plant.stage === 3 ? 220 : 168;
  return plant.stage === 3 ? 184 : 140;
}

export function startGardenRenderer(
  canvas: HTMLCanvasElement,
  garden: GardenData,
  onHover: (plant: HoveredPlant | null) => void,
  reducedMotion: boolean,
) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not create a Canvas 2D context.');
  const ctx: CanvasRenderingContext2D = context;
    const random = seededRandom(hashText(garden.repository));
    const plants = garden.plants.map(plant => mapPlant(plant, garden));
    plants.sort((a, b) => a.y - b.y);
    const bugFlowers = mapFlowers(garden);
    const stones = Array.from({ length: 12 }, () => ({
      x: 250 + random() * 470,
      y: 260 + random() * 180,
      s: random() > 0.68 ? 16 : 10,
    }));
    const grass = Array.from({ length: 58 }, () => ({
      x: 210 + random() * 550,
      y: 220 + random() * 226,
      c: random() > 0.55 ? "#63c755" : random() > 0.4 ? "#2d9b58" : "#9cdd5c",
    }));
    const motes = Array.from({ length: 20 }, () => ({
      x: 120 + random() * 720,
      y: 90 + random() * 370,
      phase: random() * Math.PI * 2,
      speed: 0.3 + random() * 0.5,
    }));
    const leaves = Array.from({ length: 7 }, () => ({
      x: 170 + random() * 620,
      y: 120 + random() * 270,
      phase: random() * Math.PI * 2,
      color: random() > 0.5 ? "#9ad955" : "#f4b94f",
    }));
    const butterflies = Array.from({ length: 3 }, () => ({
      x: 280 + random() * 420,
      y: 245 + random() * 150,
      phase: random() * Math.PI * 2,
      color: random() > 0.5 ? "#ff9cbc" : "#ffd45c",
    }));
    const camera = { x: 0, y: 0 };
    const targetCamera = { x: 0, y: 0 };
    const bornAt = performance.now();
    let frame = 0;

    const polygon = (points: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };

    const ellipse = (x: number, y: number, rx: number, ry: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (time: number, schedule = true, snapshot = false) => {
      if (reducedMotion) time = 0;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#55b8cf");
      sky.addColorStop(0.52, "#b5e3bf");
      sky.addColorStop(1, "#f8dda0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.18;
      for (let y = 40; y < H; y += 28) drawPixel(ctx, 0, y, W, 4, "#fff9cf");
      ctx.globalAlpha = 1;
      ellipse(785, 78, 54, 54, "rgba(255,236,138,.28)");
      ellipse(785, 78, 34, 34, "#ffe887");

      // Soft cloud banks and distant islands establish depth without extra assets.
      ctx.globalAlpha = 0.62;
      ellipse(120 + camera.x * 0.2, 142, 84, 23, "#e7f5d8");
      ellipse(186 + camera.x * 0.2, 145, 64, 17, "#e7f5d8");
      ellipse(825 + camera.x * 0.15, 184, 100, 26, "#dff1cf");
      ctx.globalAlpha = 0.22;
      polygon(
        [
          [70, 262],
          [168, 205],
          [270, 263],
          [168, 286],
        ],
        "#3e947b",
      );
      polygon(
        [
          [712, 248],
          [820, 188],
          [930, 250],
          [820, 278],
        ],
        "#3e947b",
      );
      ctx.globalAlpha = 1;

      camera.x += (targetCamera.x - camera.x) * 0.035;
      camera.y += (targetCamera.y - camera.y) * 0.035;
      ctx.save();
      ctx.translate(camera.x, camera.y);

      // Floating island: shadow, tapered rock body, moss rim, then the emerald top.
      ellipse(490, 508, 265, 25, "rgba(31,69,66,.18)");
      polygon(
        [
          [164, 322],
          [478, 490],
          [804, 318],
          [765, 378],
          [664, 438],
          [590, 514],
          [480, 548],
          [369, 510],
          [292, 439],
          [197, 380],
        ],
        "#76523f",
      );
      polygon(
        [
          [164, 322],
          [478, 490],
          [480, 548],
          [369, 510],
          [292, 439],
          [197, 380],
        ],
        "#5d443b",
      );
      polygon(
        [
          [804, 318],
          [478, 490],
          [480, 548],
          [590, 514],
          [664, 438],
          [765, 378],
        ],
        "#8b6043",
      );
      polygon(
        [
          [231, 371],
          [478, 501],
          [727, 371],
          [681, 410],
          [478, 523],
          [277, 410],
        ],
        "#9d6d45",
      );
      polygon(
        [
          [320, 430],
          [478, 514],
          [638, 428],
          [595, 468],
          [480, 540],
          [365, 472],
        ],
        "#4d3c38",
      );
      // Rock highlights make the cliff read as faceted, dimensional terrain.
      polygon(
        [
          [238, 384],
          [282, 408],
          [271, 435],
          [222, 400],
        ],
        "#bd8252",
      );
      polygon(
        [
          [690, 402],
          [745, 369],
          [730, 407],
          [680, 438],
        ],
        "#c28b57",
      );
      polygon(
        [
          [392, 484],
          [430, 502],
          [415, 526],
          [374, 507],
        ],
        "#7d5947",
      );
      polygon(
        [
          [555, 492],
          [608, 462],
          [580, 510],
          [544, 529],
        ],
        "#a06d4b",
      );
      polygon(
        [
          [158, 303],
          [218, 257],
          [325, 211],
          [480, 183],
          [636, 211],
          [744, 257],
          [810, 303],
          [766, 351],
          [651, 414],
          [480, 484],
          [309, 414],
          [196, 351],
        ],
        "#186d4a",
      );
      polygon(
        [
          [172, 292],
          [231, 248],
          [334, 207],
          [480, 183],
          [628, 207],
          [729, 248],
          [796, 292],
          [751, 335],
          [641, 392],
          [480, 458],
          [321, 392],
          [211, 335],
        ],
        "#38a84f",
      );
      polygon(
        [
          [203, 289],
          [329, 220],
          [478, 194],
          [478, 442],
          [324, 380],
          [224, 327],
        ],
        "#43ba55",
      );
      polygon(
        [
          [478, 194],
          [625, 219],
          [766, 291],
          [738, 327],
          [635, 380],
          [478, 442],
        ],
        "#2f9f4e",
      );
      polygon(
        [
          [257, 275],
          [370, 224],
          [479, 205],
          [479, 250],
          [365, 265],
        ],
        "#69d45b",
      );

      // Curved trail and jewel-like pond are clipped visually to the top plane.
      ctx.strokeStyle = "#d6a65b";
      ctx.lineWidth = 56;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(482, 458);
      ctx.bezierCurveTo(570, 398, 433, 344, 520, 292);
      ctx.bezierCurveTo(565, 264, 550, 224, 525, 207);
      ctx.stroke();
      ctx.strokeStyle = "#b68549";
      ctx.lineWidth = 5;
      ctx.setLineDash([18, 25]);
      ctx.stroke();
      ctx.setLineDash([]);
      [
        [477, 434],
        [510, 397],
        [491, 356],
        [499, 313],
        [534, 273],
        [536, 232],
      ].forEach(([x, y], index) => {
        drawPixel(ctx, x - 9, y, 19, 5, index % 2 ? "#edc578" : "#c99b5c");
        drawPixel(ctx, x + 6, y - 4, 8, 4, "#f5d58a");
      });
      ellipse(335, 356, 67, 35, "#176f7a");
      ellipse(335, 349, 60, 31, "#36a9a2");
      ellipse(318, 339, 42, 13, "#71d2bd");
      ellipse(309, 356, 15, 7, "#3a9c52");
      ellipse(358, 365, 13, 6, "#65bd55");
      drawPixel(ctx, 356, 356, 8, 8, "#ff9ec1");

      grass.forEach((g) => {
        const nx = (g.x - 480) / 310;
        const ny = (g.y - 330) / 145;
        if (nx * nx + ny * ny < 0.8) {
          drawPixel(ctx, g.x, g.y, 4, 11, g.c);
          drawPixel(ctx, g.x - 4, g.y + 4, 4, 5, g.c);
        }
      });
      stones.forEach((stone) => {
        const nx = (stone.x - 480) / 310;
        const ny = (stone.y - 330) / 145;
        if (nx * nx + ny * ny < 0.72) {
          drawPixel(ctx, stone.x, stone.y, stone.s, stone.s - 4, "#667a66");
          drawPixel(ctx, stone.x + 4, stone.y - 4, stone.s - 4, 5, "#c1c08b");
        }
      });

      // Layered shrubs mark cluster edges without filling the central clearing.
      [
        [238, 315],
        [687, 295],
        [628, 383],
        [289, 396],
      ].forEach(([x, y], index) => {
        drawPixel(ctx, x - 5, y + 3, 52, 13, "#17643f");
        drawPixel(ctx, x, y - 5, 25, 19, "#208849");
        drawPixel(ctx, x + 21, y - 10, 29, 23, index % 2 ? "#42b84f" : "#2c9c4d");
        drawPixel(ctx, x + 9, y - 14, 18, 12, "#5bc454");
        drawPixel(ctx, x + 26, y - 14, 12, 7, "#9fe063");
        if (index === 1 || index === 3) {
          drawPixel(ctx, x + 4, y - 8, 5, 5, "#f4b6d0");
          drawPixel(ctx, x + 39, y - 4, 5, 5, "#ffe278");
        }
      });

      // At most twelve bug-fix flowers are displayed, independent of the analyzed total.
      bugFlowers.forEach((flower) => {
        const colors = ["#ff9db8", "#ffd45b", "#b9a3ff", "#ff8a67"];
        const bob = Math.round(Math.sin(time * 0.0015 + flower.x) * 1) * 2;
        drawPixel(ctx, flower.x, flower.y, 4, 13, "#277e43");
        drawPixel(ctx, flower.x - 4 + bob, flower.y - 6, 7, 7, colors[flower.variant]);
        drawPixel(ctx, flower.x + 4 + bob, flower.y - 6, 7, 7, colors[flower.variant]);
        drawPixel(ctx, flower.x + bob, flower.y - 10, 7, 7, "#fff2a0");
      });

      // Two quiet mushroom groups reward closer inspection without adding visual noise.
      [
        [704, 348, "#e86f5b"],
        [397, 392, "#f1b957"],
      ].forEach(([x, y, color]) => {
        drawPixel(ctx, Number(x), Number(y), 5, 13, "#f4dfb7");
        drawPixel(ctx, Number(x) - 7, Number(y) - 6, 19, 9, String(color));
        drawPixel(ctx, Number(x) - 1, Number(y) - 6, 4, 4, "#fff0c6");
        drawPixel(ctx, Number(x) + 17, Number(y) + 6, 4, 9, "#ead5ad");
        drawPixel(ctx, Number(x) + 12, Number(y) + 1, 15, 8, String(color));
      });
      drawPixel(ctx, 583, 286, 12, 50, "#a36a3d");
      drawPixel(ctx, 565, 278, 54, 28, "#d69a50");
      drawPixel(ctx, 574, 286, 34, 5, "#754730");

      const growth = reducedMotion || snapshot ? 1 : Math.min(1, (time - bornAt) / 1400);
      plants.forEach((plant, index) => drawPlant(ctx, plant, time, growth, index));

      butterflies.forEach((bug) => {
        const bx = bug.x + Math.sin(time * 0.001 + bug.phase) * 20;
        const by = bug.y + Math.cos(time * 0.0017 + bug.phase) * 9;
        const flap = Math.sin(time * 0.014 + bug.phase) > 0 ? 6 : 3;
        drawPixel(ctx, bx - flap, by, flap, 5, bug.color);
        drawPixel(ctx, bx + 3, by, flap, 5, bug.color);
        drawPixel(ctx, bx, by + 2, 4, 5, "#604a45");
      });
      leaves.forEach((leaf) => {
        const drift = (time * 0.018 + leaf.phase * 80) % 480;
        drawPixel(
          ctx,
          leaf.x + Math.sin(time * 0.001 + leaf.phase) * 28,
          80 + ((leaf.y + drift) % 390),
          7,
          4,
          leaf.color,
        );
      });
      ctx.restore();

      motes.forEach((fly) => {
        const pulse = Math.sin(time * 0.002 * fly.speed + fly.phase);
        if (pulse > 0.15) {
          ctx.globalAlpha = 0.25 + pulse * 0.65;
          drawPixel(ctx, fly.x + Math.sin(time * 0.0005 + fly.phase) * 10, fly.y, 4, 4, "#fff39a");
          if (pulse > 0.8) {
            ctx.globalAlpha = 0.12;
            ellipse(fly.x, fly.y, 8, 8, "#fff6a8");
          }
          ctx.globalAlpha = 1;
        }
      });

      if (!reducedMotion && schedule) frame = requestAnimationFrame(render);
    };

    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      const y = ((event.clientY - rect.top) / rect.height) * H;
      targetCamera.x = reducedMotion ? 0 : ((x / W) * 2 - 1) * -8;
      targetCamera.y = reducedMotion ? 0 : ((y / H) * 2 - 1) * -5;
      let match: Plant | undefined;
      for (let index = plants.length - 1; index >= 0; index--) {
        const plant = plants[index];
        const height =
          plantHeight(plant);
        if (Math.abs(x - (plant.x + camera.x)) < (plant.stage >= 2 ? 58 : 30) && y < plant.y + camera.y + 12 && y > plant.y + camera.y - height) {
          match = plant;
          break;
        }
      }
      canvas.style.cursor = match ? "pointer" : "crosshair";
      onHover(
        match
          ? {
              x: match.x + camera.x,
              y: match.y + camera.y - plantHeight(match),
              month: match.month,
              commits: match.commits,
              stage: match.stage,
            }
          : null,
      );
    };
    const handleLeave = () => {
      targetCamera.x = 0;
      targetCamera.y = 0;
      onHover(null);
    };
    canvas.addEventListener("pointermove", handlePointer);
    canvas.addEventListener("pointerleave", handleLeave);
    render(performance.now());
    return {
      snapshot: () => render(performance.now(), false, true),
      dispose: () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", handlePointer);
      canvas.removeEventListener("pointerleave", handleLeave);
      onHover(null);
      },
    };

}
