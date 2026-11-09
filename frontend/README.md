# CodeGarden frontend

The Figma Make island, Canvas artwork, stylesheet, fonts, logo, and icons were
adapted from the supplied `project.zip`. The separately named
`CodeGarden-Figma-Export` directory was not present. Figma development and
deployment plugins are not used.

## Local development

Tested with Node.js 24.13 and Python 3.12. From the project root, start the backend
in one PowerShell terminal:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to
http://127.0.0.1:8000. `npm.cmd` avoids PowerShell's script execution policy;
on macOS/Linux use `npm`.

The optional `GITHUB_TOKEN` belongs only in the backend environment. The frontend
does not read it. Errors never fall back to successful demo data. The local Demo
Garden remains explicitly labeled until a real request succeeds. On a later
failed request, the previous successful garden remains visible with its own
repository label and the new request error.

## Source organization

- `src/App.tsx`: request lifecycle, cancellation, page composition, PNG download.
- `src/components/`: original form, Canvas wrapper, real statistics, logo/icons.
- `src/api.ts`, `src/types.ts`: GitHub URL validation and FastAPI contract.
- `src/data/demo.ts`: explicit synthetic example data only.
- `src/garden/layout.ts`: pure coordinate conversion and decorative variants.
- `src/garden/renderer.ts`: original island/environment artwork and camera.
- `src/garden/sprites.ts`: original plant artwork and pixel drawing primitives.

## Coordinate conversion

The unchanged backend emits a 384-by-256 garden with four plant columns and
three rows. `mapPlant` normalizes by the returned width/height, finds the source
cell around `(56 + column * 88, 64 + row * 68)`, and maps that cell into one of
the original twelve Figma island clearings. The backend's offsets are retained
within each clearing. This preserves the original path and pond instead of
stretching the rectangular backend grid over them. Flowers similarly map the
backend's lower strip into the original flower patch.

Every displayed plant is one actual backend plant. Its month, count, and stage
are preserved; only its screen position is transformed. The stable frontend
hash selects the original oak/cedar/willow visual variant and environmental
decoration, never GitHub statistics or growth stages. Tooltips use the same
mapped plant objects as rendering, in inverse depth order, with camera offsets.

Reduced motion disables the animation loop and camera movement and immediately
draws grown plants. PNG export draws a complete growth frame before capturing
the original 960-by-560 Canvas.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests use installed Microsoft Edge on Windows. Install Edge if missing,
or select another installed Playwright browser channel in
`playwright.config.ts`. These tests use synthetic HTTP fixtures, verify hover
identity, validate PNG bytes/dimensions, exercise errors and reset, and check
mobile overflow and reduced motion.

The real GitHub browser integration is opt-in and requires the backend:

```powershell
$env:CODEGARDEN_LIVE = '1'
npm.cmd run test:e2e
```

It calls the actual API through the Vite proxy, checks the rendered counts
against the response, and saves screenshots in ignored `test-results/`.
Without the variable it is skipped. A live GitHub error fails this test.

Backend regression checks, from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
```

## Limits

- Analysis remains limited to the default branch and up to 300 commits.
- Display limits and partial-history notices use the backend response.
- Requests are not cached. Refreshing requests GitHub data again.
- Google Fonts needs internet access; the original serif/monospace/sans-serif
  fallbacks remain available.
- Production static hosting needs a reverse proxy for `/api` to FastAPI.
  The Vite development proxy is not a production Python server.
- No deployment, authentication, database, or backend business logic changes
  are included.
