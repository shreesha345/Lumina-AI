# Canvas Rules

## Tool Choice

- Use `update_scene` for simple diagrams with a modest element count: flowcharts, comparisons, step-by-step layouts, labeled boxes, and arrows.
- Use `add_svg` for:
  - animation or motion,
  - dense or precise layouts that likely exceed roughly 10-12 meaningful elements,
  - polished visuals with curves, gradients, charts, scientific illustrations, or mixed decorative/detail-heavy content.
- If the request mentions animation, moving parts, orbiting, pulsing, flowing, rotating, or waveform-style motion, use `add_svg`.

## Placement

- Treat images, PDFs, embeddables, iframes, and floating overlays as protected content.
- Prefer placing new visuals to the right of protected content with at least 150px horizontal spacing.
- Avoid redrawing the same visual if a close match already exists.

## Safety

- Do not remove protected user assets unless the user clearly asked for it.
- For updates, prefer targeted cleanup over full-canvas clearing.
- Prefer one final drawing call after planning. Extra tool calls should only be for inspection or precise cleanup.

## Output Quality

- Use saturated but readable colors.
- Keep labels short and legible.
- Prefer one visual that teaches clearly over multiple competing visuals.
