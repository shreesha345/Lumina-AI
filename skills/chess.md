# Chess Game Tool — Skill Reference

The `chess_game` tool creates an interactive SVG chess board on the Excalidraw canvas with all pieces ready to play. Pieces are moved through tool calls — the board updates automatically after each move.

---

## Tool: `chess_game`

### Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `start` | — | Create a new chess board with all 32 pieces in starting position |
| `move` | `from`, `to`, `promotion?` | Move a piece from one square to another |
| `ai_move` | — | AI automatically picks and plays the best move |
| `valid_moves` | `square` | Show all legal moves for the piece on a given square |
| `state` | — | Get the current game state (turn, status, captures) |
| `reset` | — | Reset the board to starting position |

### Square Notation

Squares use standard algebraic notation: **file** (a-h) + **rank** (1-8).
- `e2` = file e, rank 2 (white pawn starting row)
- `e4` = file e, rank 4 (center)
- `g1` = file g, rank 1 (white knight starting square)

### Example Tool Calls

**Start a game:**
```
chess_game: action="start"
```

**Move a piece:**
```
chess_game: action="move", from="e2", to="e4"
```

**AI makes its own move:**
```
chess_game: action="ai_move"
```

**Show valid moves for a piece:**
```
chess_game: action="valid_moves", square="e2"
```

**Check game state:**
```
chess_game: action="state"
```

**Pawn promotion (to queen by default, or specify):**
```
chess_game: action="move", from="e7", to="e8", promotion="Q"
```

---

## How It Works

### Board Rendering
- The board is rendered as a **single static SVG** (no animation tags) embedded as a permanent image on the Excalidraw canvas.
- Contains: wooden border, 8×8 colored grid, coordinate labels (a-h, 1-8), all pieces using Unicode chess symbols, status text, captured pieces display.
- When a move is made, the **old board is replaced** with a new SVG showing the updated position.
- **Last move** is highlighted in yellow (from and to squares).
- **Check** is highlighted in red on the king's square.
- **Valid moves** are shown as green dots (empty squares) or green rings (capture targets).

### Pieces & Colors
| Piece | White | Black |
|-------|-------|-------|
| King | ♔ | ♚ |
| Queen | ♕ | ♛ |
| Rook | ♖ | ♜ |
| Bishop | ♗ | ♝ |
| Knight | ♘ | ♞ |
| Pawn | ♙ | ♟ |

### Game State Tracking
The engine tracks internally:
- Board position (all piece locations)
- Whose turn it is (white/black)
- Castling rights (kingside/queenside for both colors)
- En passant target square
- Move history with algebraic notation
- Captured pieces
- Game status: playing, check, checkmate, stalemate

---

## Chess Rules (Built-in)

### Piece Movement
| Piece | Movement |
|-------|----------|
| **King** | One square in any direction. Cannot move into check. |
| **Queen** | Any number of squares horizontally, vertically, or diagonally. |
| **Rook** | Any number of squares horizontally or vertically. |
| **Bishop** | Any number of squares diagonally. |
| **Knight** | "L" shape: 2+1. Can jump over pieces. |
| **Pawn** | Forward 1 (or 2 from start). Captures diagonally. |

### Special Moves (all handled automatically)
- **Castling**: King moves 2 squares toward rook → `move from="e1" to="g1"` (kingside) or `to="c1"` (queenside)
- **En Passant**: Automatically detected when a pawn captures en passant
- **Pawn Promotion**: When a pawn reaches the last rank, it promotes (default: Queen). Use `promotion="R"`, `"B"`, or `"N"` for other pieces.
- **Check/Checkmate/Stalemate**: Automatically detected after every move

### Move Validation
Every move is fully validated:
- Piece must exist on the source square
- Must be the correct color's turn
- The move must be legal for that piece type
- Move must not leave own king in check
- Special rules (castling conditions, en passant eligibility) are enforced

---

## AI Move Engine

When `ai_move` is called, the built-in AI:
1. Evaluates all legal moves
2. Uses material evaluation (piece values: P=1, N=3, B=3, R=5, Q=9)
3. Adds positional scoring (center control bonus)
4. Prioritizes checkmate moves
5. Adds slight randomness for variety

The AI plays as whichever color's turn it is.

---

## Conversation Flow

### The user can say:
| User says | AI does |
|-----------|---------|
| "Let's play chess" | Calls `chess_game action="start"` |
| "Move e2 to e4" / "e4" | Calls `chess_game action="move" from="e2" to="e4"` |
| "Your turn" / "Make your move" | Calls `chess_game action="ai_move"` |
| "What moves can my knight make?" | Calls `chess_game action="valid_moves" square="g1"` |
| "Castle kingside" | Calls `chess_game action="move" from="e1" to="g1"` |
| "What's the position?" | Calls `chess_game action="state"` |
| "New game" / "Reset" | Calls `chess_game action="reset"` |

### Example game flow:
```
User: "Let's play chess!"
→ chess_game action="start"
→ Board appears with all pieces. "White to move."

User: "e4"
→ chess_game action="move" from="e2" to="e4"
→ Board updates, pawn on e4 highlighted. "Black to move."

User: "Your turn"
→ chess_game action="ai_move"
→ AI plays e5. Board updates. "White to move."

User: "Knight f3"
→ chess_game action="move" from="g1" to="f3"
→ Board updates. "Black to move."

User: "AI move"
→ chess_game action="ai_move"
→ AI plays Nc6. Board updates.
```

---

## Error Handling

The tool returns clear error messages:
| Situation | Error message |
|-----------|--------------|
| No game started | "No game in progress. Start a game first." |
| Invalid square | "Invalid square: x9" |
| No piece on square | "No piece on e5." |
| Wrong color | "It's white's turn, but e7 has a black piece." |
| Illegal move | "Illegal move: e2 to e5. Piece cannot move there." |
| Game already over | "Game is over: checkmate." |

---

## Important Notes

1. **The board is a permanent canvas image** — no animations, no overlays, no auto-dismiss. It persists until the game is reset or cleared.
2. **All pieces are part of the board SVG** — the board + pieces render as one cohesive image that gets replaced on each move.
3. **The tool handles everything** — move validation, special moves, check/checkmate detection, board rendering, canvas element management.
4. **The AI agent just calls the tool** — no need to generate SVGs manually or manage canvas elements directly.
5. **Voice-compatible** — the user can speak moves through the Lumina audio interface.
