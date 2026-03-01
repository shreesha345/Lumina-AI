# Lumina Canvas Skills Reference

You have two tools: `get_canvas` and `update_scene`. Use them to draw visual explanations on an Excalidraw whiteboard canvas.

---

## Tool: get_canvas

Returns all elements currently on the canvas as JSON. Use this to:
- See what's already drawn before adding to it
- Find element IDs for pointing
- Check positions to avoid overlapping new content

No parameters needed — just call it.

---

## Tool: update_scene

Draw on the canvas. The `clear_first` parameter controls the mode:

### Modes (clear_first values)

| Mode | What it does |
|------|-------------|
| `"yes"` | Clears canvas first, then draws `elements_json` — use for new diagrams |
| `"no"` | Appends `elements_json` to existing canvas — use to add elements |
| `"pointer"` | Shows a red laser pointer at `pointer_x`, `pointer_y` with optional `pointer_label` |
| `"clear_pointer"` | Removes the pointer |
| `"clear_all"` | Wipes the entire canvas |

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `clear_first` | Yes | Mode: `"yes"`, `"no"`, `"pointer"`, `"clear_pointer"`, `"clear_all"` |
| `elements_json` | For yes/no | JSON array **string** of elements to draw |
| `pointer_x` | For pointer | X coordinate as string number |
| `pointer_y` | For pointer | Y coordinate as string number |
| `pointer_label` | Optional | Label text for the pointer |

---

## Element JSON Format

Elements are passed as a JSON string array in `elements_json`. The system auto-converts your simplified skeleton into proper Excalidraw elements.

### Coordinate System
- Origin (0,0) is top-left of canvas
- x increases → rightward
- y increases ↓ downward
- Typical usable area: 0-1200 x, 0-800 y

### Common Properties (all elements)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | required | `"rectangle"`, `"ellipse"`, `"diamond"`, `"text"`, `"arrow"`, `"line"` |
| `id` | string | auto | Unique ID — needed if arrows connect to this shape |
| `x` | number | 0 | Left edge X position |
| `y` | number | 0 | Top edge Y position |
| `width` | number | 200 | Width |
| `height` | number | 80 | Height |

### Styling Properties (optional)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `strokeColor` | string | `"#1e1e1e"` | Border/outline color |
| `backgroundColor` | string | `"transparent"` | Fill color |
| `fillStyle` | string | `"solid"` | `"solid"`, `"hachure"`, `"cross-hatch"` |
| `strokeWidth` | number | 2 | Border thickness |
| `roughness` | number | 1 | 0=clean, 1=sketchy, 2=very rough |
| `opacity` | number | 100 | 0 (invisible) to 100 (opaque) |
| `roundness` | object/null | null | `{"type":3}` for rounded corners |
| `strokeStyle` | string | `"solid"` | `"solid"`, `"dashed"`, `"dotted"` |

---

## Element Types

### Shapes: rectangle, ellipse, diamond

```json
{
  "type": "rectangle",
  "id": "box1",
  "x": 100, "y": 100,
  "width": 200, "height": 80,
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "roundness": {"type": 3},
  "label": {"text": "My Label", "fontSize": 18}
}
```

**Key points:**
- Use `label.text` to put centered text inside the shape — do NOT create a separate text element for labels
- `label.fontSize` defaults to 18 if omitted
- Minimum practical size for labeled shapes: 120×60
- All three shape types (rectangle, ellipse, diamond) support labels
- You can also use `"labelText": "My Label"` as a shorthand instead of the label object

### Standalone Text

```json
{
  "type": "text",
  "id": "title1",
  "x": 200, "y": 30,
  "text": "Diagram Title",
  "fontSize": 28
}
```

**Key points:**
- `x` is the LEFT edge of the text
- Use fontSize 24-32 for titles, 16-20 for body text
- Do NOT use emoji in text — they don't render in Excalidraw's font
- To roughly center: set x ≈ center_position - (text.length × fontSize × 0.3)

### Arrows

```json
{
  "type": "arrow",
  "id": "arrow1",
  "x": 300, "y": 180,
  "points": [[0, 0], [0, 70]],
  "endArrowhead": "arrow"
}
```

**Key points:**
- `x`, `y` = start point of the arrow
- `points` = array of `[dx, dy]` offsets **relative to x,y** — always starts with `[0,0]`
- `endArrowhead`: `"arrow"` (default), `"triangle"`, `"bar"`, `"dot"`, or `null`
- `startArrowhead`: same options, default `null`
- Add a label: `"label": {"text": "connects to"}`

### Arrow Routing Patterns

**Vertical (top to bottom):**
```
Arrow x = source shape center X
Arrow y = source shape bottom (source.y + source.height)
points = [[0, 0], [0, gap_to_next_shape]]
```

**Horizontal (left to right):**
```
Arrow x = source shape right edge (source.x + source.width)
Arrow y = source shape center Y (source.y + source.height/2)
points = [[0, 0], [gap_to_next_shape, 0]]
```

**Diagonal:**
```
points = [[0, 0], [dx, dy]] where dx/dy = offset to target
```

**Branching (one source, two targets):**
```
Left branch:  points = [[0, 0], [-horizontal_dist, vertical_dist]]
Right branch: points = [[0, 0], [horizontal_dist, vertical_dist]]
```

### Auto-routing with startId/endId

Instead of calculating points manually, you can use shape IDs:
```json
{
  "type": "arrow",
  "id": "a1",
  "startId": "box1",
  "endId": "box2",
  "endArrowhead": "arrow"
}
```
The system will auto-calculate arrow position and points based on the shapes' positions.

### Lines

Same as arrows but with `"type": "line"` and no arrowheads by default.

---

## Color Palette

### Background fills (pastel — for shapes)
| Name | Hex | Use for |
|------|-----|---------|
| Light Blue | `#a5d8ff` | Input, sources, primary concepts |
| Light Green | `#b2f2bb` | Success, output, results |
| Light Orange | `#ffd8a8` | Warning, pending, external |
| Light Purple | `#d0bfff` | Processing, middleware, steps |
| Light Red | `#ffc9c9` | Error, critical, important |
| Light Yellow | `#fff3bf` | Notes, decisions, highlights |
| Light Teal | `#c3fae8` | Storage, data, memory |
| Dark Blue | `#1971c2` | Emphasized fills |
| Dark Green | `#2f9e44` | Emphasized fills |

### Stroke colors
| Name | Hex |
|------|-----|
| Default | `#1e1e1e` |
| Blue | `#1971c2` |
| Green | `#2f9e44` |
| Red | `#e03131` |
| Purple | `#7048e8` |
| Orange | `#e8590c` |

---

## Layout Best Practices

1. **Spacing**: Leave 50-80px gaps between shapes vertically, 40-60px horizontally
2. **Alignment**: Keep shapes on a grid — align centers or edges
3. **Size consistency**: Use the same width/height for shapes at the same level
4. **Titles**: Place title text 30-50px above the first row of shapes
5. **Arrows**: Draw all shapes first in the array, arrows last (z-order)
6. **Background zones**: For grouping, draw a large translucent rectangle first with low opacity

## Element Array Order = Z-order
- First element = drawn at the back
- Last element = drawn on top
- Pattern: background zones → shapes → arrows → text labels → pointer

---

## Workflow Patterns

### Pattern 1: New diagram
1. Call `update_scene` with `clear_first: "yes"` and full diagram in one `elements_json`
2. Speak about the diagram while it renders

### Pattern 2: Explain parts with pointer
1. Draw diagram first (Pattern 1)
2. Call `update_scene` with `clear_first: "pointer"`, `pointer_x`, `pointer_y` pointing at specific elements
3. Explain what the pointer is showing
4. Move pointer to next part
5. Call `clear_pointer` when done

### Pattern 3: Build up incrementally
1. Draw initial part with `clear_first: "yes"`
2. Add more elements with `clear_first: "no"` — they appear alongside existing ones
3. Useful for step-by-step visual building

### Pattern 4: Modify existing
1. Call `get_canvas` to see current elements
2. Call `update_scene` with `clear_first: "yes"` to redraw with modifications

---

## Complete Examples

### Flowchart (vertical)
```json
[
  {"type":"text","id":"title","x":250,"y":20,"text":"Data Pipeline","fontSize":28},
  {"type":"rectangle","id":"input","x":250,"y":80,"width":200,"height":70,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Input Data","fontSize":18}},
  {"type":"rectangle","id":"process","x":250,"y":220,"width":200,"height":70,"backgroundColor":"#d0bfff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Process","fontSize":18}},
  {"type":"rectangle","id":"output","x":250,"y":360,"width":200,"height":70,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Output","fontSize":18}},
  {"type":"arrow","id":"a1","x":350,"y":150,"points":[[0,0],[0,70]],"endArrowhead":"arrow"},
  {"type":"arrow","id":"a2","x":350,"y":290,"points":[[0,0],[0,70]],"endArrowhead":"arrow"}
]
```

### Horizontal flow with labels
```json
[
  {"type":"text","id":"title","x":200,"y":20,"text":"Request Flow","fontSize":28},
  {"type":"rectangle","id":"client","x":50,"y":100,"width":180,"height":70,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Client","fontSize":18}},
  {"type":"rectangle","id":"server","x":340,"y":100,"width":180,"height":70,"backgroundColor":"#d0bfff","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Server","fontSize":18}},
  {"type":"rectangle","id":"db","x":630,"y":100,"width":180,"height":70,"backgroundColor":"#c3fae8","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Database","fontSize":18}},
  {"type":"arrow","id":"a1","x":230,"y":135,"points":[[0,0],[110,0]],"endArrowhead":"arrow","label":{"text":"HTTP"}},
  {"type":"arrow","id":"a2","x":520,"y":135,"points":[[0,0],[110,0]],"endArrowhead":"arrow","label":{"text":"SQL"}}
]
```

### Branching decision
```json
[
  {"type":"diamond","id":"decision","x":250,"y":50,"width":200,"height":100,"backgroundColor":"#fff3bf","fillStyle":"solid","label":{"text":"Is Valid?","fontSize":18}},
  {"type":"rectangle","id":"yes","x":100,"y":230,"width":180,"height":70,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Process","fontSize":18}},
  {"type":"rectangle","id":"no","x":420,"y":230,"width":180,"height":70,"backgroundColor":"#ffc9c9","fillStyle":"solid","roundness":{"type":3},"label":{"text":"Reject","fontSize":18}},
  {"type":"arrow","id":"a1","x":300,"y":150,"points":[[0,0],[-110,80]],"endArrowhead":"arrow","label":{"text":"Yes"}},
  {"type":"arrow","id":"a2","x":400,"y":150,"points":[[0,0],[110,80]],"endArrowhead":"arrow","label":{"text":"No"}}
]
```

### Concept map with zones
```json
[
  {"type":"rectangle","id":"zone","x":30,"y":60,"width":640,"height":320,"backgroundColor":"#f8f9fa","fillStyle":"solid","opacity":40,"strokeStyle":"dashed","strokeColor":"#868e96"},
  {"type":"text","id":"title","x":200,"y":20,"text":"Neural Network","fontSize":28},
  {"type":"ellipse","id":"n1","x":50,"y":150,"width":120,"height":120,"backgroundColor":"#a5d8ff","fillStyle":"solid","label":{"text":"Input","fontSize":16}},
  {"type":"ellipse","id":"n2","x":280,"y":150,"width":120,"height":120,"backgroundColor":"#d0bfff","fillStyle":"solid","label":{"text":"Hidden","fontSize":16}},
  {"type":"ellipse","id":"n3","x":520,"y":150,"width":120,"height":120,"backgroundColor":"#b2f2bb","fillStyle":"solid","label":{"text":"Output","fontSize":16}},
  {"type":"arrow","id":"a1","x":170,"y":210,"points":[[0,0],[110,0]],"endArrowhead":"arrow","label":{"text":"weights"}},
  {"type":"arrow","id":"a2","x":400,"y":210,"points":[[0,0],[120,0]],"endArrowhead":"arrow","label":{"text":"activation"}}
]
```

---

## Common Mistakes to Avoid

1. **Don't use emoji** in text/labels — Excalidraw can't render them
2. **Don't create separate text elements for shape labels** — use `label.text` inside the shape
3. **Don't forget `fillStyle: "solid"`** when using `backgroundColor` — without it the fill won't show
4. **Don't make shapes too small** — minimum 120×60 for readable labels
5. **Don't put arrows before shapes** in the array — arrows should come last for proper z-order
6. **Don't use random coordinates** — align elements on a logical grid
7. **Always include `"endArrowhead": "arrow"`** on arrows — otherwise they look like plain lines
8. **Keep diagrams simple** — 3-8 shapes per diagram is ideal, more gets cluttered
9. **Use ONE update_scene call** for a complete diagram — don't draw shapes one at a time
10. **Points array always starts with `[0,0]`** — it's relative to the arrow's x,y position
