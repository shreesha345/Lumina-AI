# Excalidraw JSON Reference for Lumina AI

This document is the complete reference for generating Excalidraw diagrams via JSON.
It is loaded by the AI system prompt at runtime.

---

## Element Types & Properties

### Common Properties (all elements)
- `type`: Element type string
- `id`: Unique string identifier (required for binding)
- `x`, `y`: Position coordinates (x→right, y→down)
- `width`, `height`: Dimensions

### Optional Styling (with defaults)
- `strokeColor`: Border color (default `"#1e1e1e"`)
- `backgroundColor`: Fill color (default `"transparent"`)
- `fillStyle`: `"solid"`, `"hachure"`, `"cross-hatch"` (default `"solid"`)
- `strokeWidth`: Border thickness (default `2`)
- `roughness`: Hand-drawn look, 0=clean, 1=normal, 2=rough (default `1`)
- `opacity`: 0-100 (default `100`)
- `roundness`: `{"type": 3}` for rounded corners, `null` for sharp
- `strokeStyle`: `"solid"`, `"dashed"`, `"dotted"`

---

## Shapes: rectangle, ellipse, diamond

```json
{"type":"rectangle","id":"r1","x":100,"y":100,"width":200,"height":80,
 "backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},
 "label":{"text":"My Label","fontSize":20}}
```

- Add `label.text` for auto-centered text inside the shape
- Label auto-sizes to fit — no separate text element needed
- Works on rectangle, ellipse, diamond

## Standalone Text

```json
{"type":"text","id":"t1","x":150,"y":50,"text":"Hello World","fontSize":24}
```

- `x` is the LEFT edge of the text
- To center text at position cx: set x = cx - (text.length × fontSize × 0.5) / 2
- Minimum fontSize: 16 for body, 20 for titles

## Arrows

```json
{"type":"arrow","id":"a1","x":300,"y":150,"width":200,"height":0,
 "points":[[0,0],[200,0]],"endArrowhead":"arrow",
 "startBinding":{"elementId":"r1","fixedPoint":[1,0.5]},
 "endBinding":{"elementId":"r2","fixedPoint":[0,0.5]}}
```

- `points`: Array of [dx, dy] offsets from element x,y
- `endArrowhead`: `null`, `"arrow"`, `"bar"`, `"dot"`, `"triangle"`
- `startArrowhead`: Same options

### Arrow Binding (connecting to shapes)
- `startBinding.elementId`: ID of shape where arrow starts
- `endBinding.elementId`: ID of shape where arrow ends
- `fixedPoint`: [xRatio, yRatio] on the target shape:
  - Top center: `[0.5, 0]`
  - Bottom center: `[0.5, 1]`
  - Left center: `[0, 0.5]`
  - Right center: `[1, 0.5]`
- Arrow labels: `"label": {"text": "data flow", "fontSize": 14}`

### Arrow Routing (how to draw connecting arrows)
When connecting two shapes, calculate the arrow position and points:

**Vertical (Top to Bottom):**
- Arrow x = source center X
- Arrow y = source bottom (source.y + source.height)
- Point 1: [0, 0]
- Point 2: [target_center_x - source_center_x, target.y - arrow.y]

**Horizontal (Left to Right):**
- Arrow x = source right edge (source.x + source.width)
- Arrow y = source center Y
- Point 1: [0, 0]
- Point 2: [target.x - arrow.x, target_center_y - source_center_y]

## Lines

```json
{"type":"line","id":"l1","x":100,"y":100,"width":200,"height":100,
 "points":[[0,0],[200,100]]}
```

---

## Color Palette

### Excalidraw Fills (pastel, for shape backgrounds)
| Color | Hex | Good For |
|-------|-----|----------|
| Light Blue | `#a5d8ff` | Input, sources, primary nodes |
| Light Green | `#b2f2bb` | Success, output, completed |
| Light Orange | `#ffd8a8` | Warning, pending, external |
| Light Purple | `#d0bfff` | Processing, middleware |
| Light Red | `#ffc9c9` | Error, critical, alerts |
| Light Yellow | `#fff3bf` | Notes, decisions, planning |
| Light Teal | `#c3fae8` | Storage, data, memory |

### Stroke Colors
| Color | Hex |
|-------|-----|
| Blue | `#1971c2` |
| Green | `#2f9e44` |
| Red | `#e03131` |
| Purple | `#7048e8` |
| Yellow | `#f08c00` |
| Orange | `#e8590c` |

---

## Layout & Sizing Rules

- Canvas coordinate system: x→right, y→down
- Typical diagram area: ~1000×700
- Minimum shape size: 120×60 for labeled shapes
- Leave 30-50px gaps between elements
- Prefer fewer, larger elements over many small ones
- Center titles above the diagram

## Element Ordering
- Array order = z-order (first = back, last = front)
- Draw background zones first, then shapes, then arrows on top

---

## Example: Flowchart with Proper Arrow Routing

```json
[
  {"type":"text","id":"title","x":250,"y":20,"text":"Data Pipeline","fontSize":28},
  {"type":"rectangle","id":"input","x":250,"y":80,"width":200,"height":70,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Input Data","fontSize":18}},
  {"type":"rectangle","id":"process","x":250,"y":220,"width":200,"height":70,"backgroundColor":"#d0bfff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Process","fontSize":18}},
  {"type":"rectangle","id":"output","x":250,"y":360,"width":200,"height":70,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Output","fontSize":18}},
  {"type":"arrow","id":"a1","x":350,"y":150,"width":0,"height":70,"points":[[0,0],[0,70]],"endArrowhead":"arrow"},
  {"type":"arrow","id":"a2","x":350,"y":290,"width":0,"height":70,"points":[[0,0],[0,70]],"endArrowhead":"arrow"}
]
```

## Example: Branching Diagram

```json
[
  {"type":"rectangle","id":"top","x":300,"y":50,"width":200,"height":70,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Start","fontSize":18}},
  {"type":"rectangle","id":"left","x":100,"y":200,"width":180,"height":70,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Option A","fontSize":18}},
  {"type":"rectangle","id":"right","x":520,"y":200,"width":180,"height":70,"backgroundColor":"#ffc9c9","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Option B","fontSize":18}},
  {"type":"arrow","id":"a1","x":400,"y":120,"width":-210,"height":80,"points":[[0,0],[-210,80]],"endArrowhead":"arrow"},
  {"type":"arrow","id":"a2","x":400,"y":120,"width":210,"height":80,"points":[[0,0],[210,80]],"endArrowhead":"arrow"}
]
```

---

## Tips
- Do NOT use emoji in text — they don't render in Excalidraw's font
- Keep arrow labels short (5-15 chars)
- Use consistent color coding throughout a diagram
- Group related elements visually with background zones (large translucent rectangles)
