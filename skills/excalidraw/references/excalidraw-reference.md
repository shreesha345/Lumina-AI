# Excalidraw Quick Reference

## Core Elements

- `rectangle`, `ellipse`, `diamond`: supply `x`, `y`, `width`, `height`, and `label.text` for centered copy.
- `text`: supply `x`, `y`, `text`, and `fontSize`.
- `arrow`, `line`: supply `x`, `y`, and `points`; prefer `endArrowhead:"arrow"` for directional flow.

## Style Defaults

- Rounded boxes: `roundness: { "type": 3 }`
- Solid fills when background color is used: `fillStyle: "solid"`
- Reliable stroke widths: `2` or `3`
- Formal diagrams: `roughness: 0`
- Friendly whiteboard feel: `roughness: 1`

## Practical Palette

- Info: background `#a5d8ff`, stroke `#1971c2`
- Success: background `#b2f2bb`, stroke `#2f9e44`
- Decision/warning: background `#fff3bf`, stroke `#f08c00`
- Error/risk: background `#ffc9c9`, stroke `#e03131`
- Special/external: background `#d0bfff`, stroke `#7048e8`

## Layout Reminders

- Leave roughly 40-80px between related items.
- Keep titles 30-50px above the first row.
- Prefer labels inside shapes instead of detached text when possible.
