# jolts — landing

Pre-launch landing page. Vite + React, deploys to Vercel with zero config
(framework auto-detects as Vite; build `npm run build`, output `dist`).

```bash
npm install
npm run dev
```

## The logo

`src/App.jsx` renders each character as its own `.char`, and each `.char` stacks
five copies of the same glyph on top of each other:

| layer | color | stroke | offset |
| --- | --- | --- | --- |
| `halo-shadow` | white | fat | shadow |
| `halo` | white | fat | — |
| `ink-shadow` | black | thin | shadow |
| `ink` | black | thin | — |
| `fill` | white | none | — |

Because the two black layers are drawn over the two white ones, the outline and
the drop shadow fuse into a single silhouette instead of reading as two separate
shapes, and the white halo traces the outside of that merged silhouette. Widths
and the shadow offset are `em`-based custom properties on `.logo`, so everything
scales together with `font-size`.

The float animation is applied to `.char` (never to the individual layers), so a
character's outline, shadow and fill always move as one piece. Delays are
staggered off `--i`.
