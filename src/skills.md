# Lumina Canvas Skills

Tools: `get_canvas`, `update_scene`, `add_svg`, `view_canvas`

## get_canvas
Returns all canvas elements as JSON. No parameters. Use to check what's drawn before adding.

## update_scene
Draw on canvas. Required param: `clear_first`.

| `clear_first` | Action |
|---|---|
| `"yes"` | Clear canvas, draw `elements_json` |
| `"no"` | Append `elements_json` to existing |
| `"pointer"` | Show laser at `pointer_x`,`pointer_y` (optional `pointer_label`) |
| `"clear_pointer"` | Remove pointer |
| `"clear_all"` | Wipe canvas |

`elements_json`: JSON array **string** of elements. System auto-converts skeleton to full Excalidraw.

## view_canvas
Captures canvas as image for you to see. No parameters. Use after drawing to verify, or when user asks what's on canvas.

## add_svg
Add SVG illustration to canvas. For creative drawings, icons, math, science, anything with curves/paths/gradients.

| Param | Required | Description |
|---|---|---|
| `svg_code` | Yes | Complete `<svg>` with `viewBox` |
| `x`,`y` | No | Position (string numbers, default "100") |
| `width`,`height` | No | Display size (string numbers) |
| `label` | No | Text below SVG |

---

## Element Format

Coords: origin (0,0) top-left, x→right, y→down. Canvas ~1200×800.

### Properties
All elements need `type` (`rectangle`/`ellipse`/`diamond`/`text`/`arrow`/`line`/`freedraw`). Optional: `id`, `x`, `y`, `width`, `height`, `strokeColor` (#1e1e1e), `backgroundColor` (transparent), `fillStyle` (solid/hachure/cross-hatch), `strokeWidth` (2), `roughness` (0=clean,1=sketch,2=rough), `opacity` (0-100), `roundness` ({"type":3}), `strokeStyle` (solid/dashed/dotted), `groupIds` ([]).

### Shapes (rectangle, ellipse, diamond)
Use `label.text` for centered text inside — NOT separate text elements. Min size 120×60.
```json
{"type":"rectangle","id":"b1","x":100,"y":100,"width":200,"height":80,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Label","fontSize":18}}
```

### Text
```json
{"type":"text","id":"t1","x":200,"y":30,"text":"Title","fontSize":28}
```
No emoji — Excalidraw can't render them. Font families: 1=Virgil(hand), 2=Helvetica(pro), 3=Cascadia(code).

### Arrows
`points` = `[dx,dy]` offsets relative to x,y, always starts `[0,0]`. Use `"endArrowhead":"arrow"`.
```json
{"type":"arrow","id":"a1","x":300,"y":150,"points":[[0,0],[0,70]],"endArrowhead":"arrow"}
```
Auto-route: use `"startId":"box1","endId":"box2"` instead of manual points. Label: `"label":{"text":"flow"}`.

### Lines
Same as arrows, `"type":"line"`, no arrowheads default. Multi-point for custom shapes:
```json
{"type":"line","x":100,"y":100,"points":[[0,0],[50,-40],[100,0],[80,50],[20,50],[0,0]],"strokeColor":"#e03131","strokeWidth":3}
```

### Freedraw
```json
{"type":"freedraw","x":100,"y":100,"points":[[0,0],[10,5],[20,3]],"strokeColor":"#e03131","simulatePressure":true}
```

---

## Colors

**Backgrounds (pastel):** Blue `#a5d8ff`, Green `#b2f2bb`, Orange `#ffd8a8`, Purple `#d0bfff`, Red `#ffc9c9`, Yellow `#fff3bf`, Teal `#c3fae8`, Gray `#e9ecef`
**Strokes:** Black `#1e1e1e`, Blue `#1971c2`, Green `#2f9e44`, Red `#e03131`, Purple `#7048e8`, Orange `#e8590c`
**Creative:** Bright Red `#ff6b6b`, Pink `#f06595`, Gold `#ffd43b`, Lime `#51cf66`, Sky `#74c0fc`, Lavender `#b197fc`, Brown `#a0522d`

**Semantic:** Blue=info/input, Green=success/output, Yellow=warning/decision, Red=error/danger, Purple=external/special

---

## Layout Rules
- 50-80px vertical gaps, 40-60px horizontal
- Z-order: background zones → shapes → arrows → text (array order = draw order)
- Draw complete diagram in ONE `update_scene` call
- Title 30-50px above first shapes, fontSize 28
- `fillStyle:"solid"` required when using `backgroundColor`

## Workflows
1. **New diagram**: `clear_first:"yes"` + full `elements_json`
2. **Point at parts**: `clear_first:"pointer"` + coordinates
3. **Build incrementally**: first `"yes"`, then `"no"` to append
4. **Modify**: `get_canvas` first, then `"yes"` to redraw

---

## Creative Drawing with add_svg

When user asks to draw/sketch/illustrate ANYTHING creative, use `add_svg`. You are a skilled artist — never refuse drawing requests. Use vibrant colors.

### Heart
```
svg_code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M100 180 C20 120 0 60 50 30 C80 10 100 40 100 40 C100 40 120 10 150 30 C200 60 180 120 100 180Z" fill="#ff6b6b" stroke="#e03131" stroke-width="3"/></svg>
x: "200", y: "100", width: "250", height: "250"
```
Colors: Red `fill="#ff6b6b"`, Pink `fill="#f06595"`, Purple `fill="#b197fc"`, Blue `fill="#74c0fc"`

### Star
```
svg_code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><polygon points="100,10 127,80 200,80 140,125 160,195 100,150 40,195 60,125 0,80 73,80" fill="#ffd43b" stroke="#f08c00" stroke-width="3"/></svg>
```

### Flower
```
svg_code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"><path d="M150 180 Q140 250 150 340" stroke="#2f9e44" stroke-width="6" fill="none"/><ellipse cx="150" cy="130" rx="35" ry="55" fill="#ff6b6b" transform="rotate(0 150 160)"/><ellipse cx="150" cy="130" rx="35" ry="55" fill="#f06595" transform="rotate(72 150 160)"/><ellipse cx="150" cy="130" rx="35" ry="55" fill="#ff8787" transform="rotate(144 150 160)"/><ellipse cx="150" cy="130" rx="35" ry="55" fill="#ffa8a8" transform="rotate(216 150 160)"/><ellipse cx="150" cy="130" rx="35" ry="55" fill="#ffc9c9" transform="rotate(288 150 160)"/><circle cx="150" cy="160" r="20" fill="#ffd43b"/></svg>
```

### Smiley (use instead of emoji)
```
svg_code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#ffd43b" stroke="#f08c00" stroke-width="4"/><circle cx="70" cy="80" r="12" fill="#1e1e1e"/><circle cx="130" cy="80" r="12" fill="#1e1e1e"/><path d="M60 120 Q100 170 140 120" fill="none" stroke="#1e1e1e" stroke-width="5" stroke-linecap="round"/></svg>
```

### Gradients
```
svg_code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><defs><linearGradient id="rb" x1="0%" x2="100%"><stop offset="0%" stop-color="#e03131"/><stop offset="50%" stop-color="#ffd43b"/><stop offset="100%" stop-color="#1971c2"/></linearGradient></defs><path d="M30 180 Q200 -40 370 180" fill="none" stroke="url(#rb)" stroke-width="20" stroke-linecap="round"/></svg>
```

### SVG Tips
- Always include `xmlns` and `viewBox`
- Keep paths simple; use basic shapes (circle, ellipse, rect, polygon, path)
- Combine `add_svg` + `update_scene(clear_first:"no")` to annotate art with labels/arrows
- Size 200-400 for small art, 400-700 for large

---

## Diagram Patterns

### Flowchart
```json
[{"type":"text","id":"t","x":250,"y":20,"text":"Pipeline","fontSize":28},{"type":"rectangle","id":"a","x":250,"y":80,"width":200,"height":70,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Input","fontSize":18}},{"type":"rectangle","id":"b","x":250,"y":220,"width":200,"height":70,"backgroundColor":"#d0bfff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Process","fontSize":18}},{"type":"arrow","id":"a1","x":350,"y":150,"points":[[0,0],[0,70]],"endArrowhead":"arrow"}]
```

### Branching
Use diamond for decisions, arrows with labels "Yes"/"No" branching left/right:
```json
[{"type":"diamond","id":"d","x":250,"y":50,"width":200,"height":100,"backgroundColor":"#fff3bf","fillStyle":"solid","label":{"text":"Valid?"}},{"type":"rectangle","id":"y","x":100,"y":230,"width":180,"height":70,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Yes"}},{"type":"rectangle","id":"n","x":420,"y":230,"width":180,"height":70,"backgroundColor":"#ffc9c9","fillStyle":"solid","roundness":{"type":3},"label":{"text":"No"}},{"type":"arrow","id":"a1","x":300,"y":150,"points":[[0,0],[-110,80]],"endArrowhead":"arrow"},{"type":"arrow","id":"a2","x":400,"y":150,"points":[[0,0],[110,80]],"endArrowhead":"arrow"}]
```

### Sequence Diagram
Actors (rectangles) at top → dashed vertical lifelines → horizontal arrows for messages (numbered). Return arrows: dashed, reversed direction.

### Architecture
Layered rectangles. Colors: Presentation=blue, Business=green, Data=purple. Components as shapes inside layers.

### Mind Map
Central ellipse → radiating branches with decreasing size/stroke per level.

---

## Key Rules
1. No emoji in text — use `add_svg` for visual symbols
2. Use `label.text` inside shapes, not separate text elements
3. Always `fillStyle:"solid"` with `backgroundColor`
4. Shapes before arrows in array (z-order)
5. Arrow points start with `[0,0]`
6. Always `"endArrowhead":"arrow"` on arrows
7. ONE `update_scene` call per complete diagram
8. For ANY creative/artistic drawing request → use `add_svg`
