---
name: excalidraw-canvas
description: Build or update whiteboard visuals for this app. Use when the agent needs reliable rules for Excalidraw scene editing, SVG generation, layout-safe placement beside PDFs/images/embeds, or animation decisions on the teaching canvas.
---

# Excalidraw Canvas

Use the bundled references progressively:

- Read [references/canvas-rules.md](references/canvas-rules.md) for tool selection, placement, and safety rules.
- Read [references/excalidraw-reference.md](references/excalidraw-reference.md) only when you need concise element/property reminders.

Follow these operating rules:

1. Inspect layout before drawing when the canvas may already contain PDFs, images, embeds, or prior diagrams.
2. Prefer one clean visual operation per request: either one `update_scene` or one `add_svg`, plus optional cleanup.
3. Use `add_svg` for animation and for dense/high-element-count diagrams where Excalidraw JSON is likely to become brittle.
4. Use `update_scene` for simple boxed diagrams, labels, arrows, and lightweight whiteboard structure.
5. Preserve user assets by default and place new visuals to the right of protected content when space is tight.
