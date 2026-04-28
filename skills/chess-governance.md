# Chess Game Governance Model

## Overview
The chess implementation enforces strict validation rules to ensure fair play and adherence to official chess rules. The Gemini Live agent plays chess against the user - it's a real opponent, not just a move executor.

## Game Setup

### Color Selection
1. User asks to play chess
2. AI asks: "Would you like to play as White or Black?"
3. User chooses their color
4. AI starts game with `action='start'` and `player_color='white'` or `'black'`
5. AI plays the opposite color

### Turn Management
- The system tracks whose turn it is
- `isAiTurn=true` means the AI must make a move
- `isPlayerTurn=true` means waiting for user's move
- Turns alternate: White → Black → White → Black...

## AI Behavior

### When It's AI's Turn
The AI must:
1. Call `action='state'` to see current position
2. Think strategically about the position
3. Use `action='valid_moves'` to see legal moves for its pieces
4. Choose a good move based on chess strategy
5. Execute the move with `action='move'`
6. Announce the move to the user

### When It's User's Turn
The AI must:
1. Wait for user to announce their move
2. Execute user's move with `action='move'`
3. Handle any illegal move errors by informing the user
4. Check if it's now AI's turn and respond accordingly

## Validation Layers

### 1. Game State Validation
- ✅ Game must be in progress (started via `action='start'`)
- ✅ Game cannot be over (no moves after checkmate/stalemate)
- ✅ Move history is tracked for all moves

### 2. Square Notation Validation
- ✅ Must use algebraic notation (a-h for files, 1-8 for ranks)
- ✅ Examples: `e2`, `e4`, `g1`, `f3`
- ❌ Invalid: `i5`, `a9`, `e0`, `E2` (case-insensitive but validated)

### 3. Piece Existence Validation
- ✅ Source square must contain a piece
- ❌ Cannot move from empty squares

### 4. Turn Enforcement
- ✅ Only the current player can move their pieces
- ✅ White moves first, then alternates
- ❌ Cannot move opponent's pieces
- ❌ Cannot skip turns

### 5. Chess Rules Validation
All moves are validated against official chess rules:

#### Piece Movement
- ✅ Pawns: forward 1 (or 2 from start), diagonal captures
- ✅ Knights: L-shape (2+1 squares)
- ✅ Bishops: diagonal lines
- ✅ Rooks: horizontal/vertical lines
- ✅ Queens: diagonal + horizontal/vertical lines
- ✅ Kings: one square in any direction

#### Special Moves
- ✅ En passant: validated for correct conditions
- ✅ Castling: validated (king/rook not moved, no check, clear path)
- ✅ Pawn promotion: automatic to Queen (or specify Q/R/B/N)

#### Check Rules
- ✅ Cannot move into check
- ✅ Must move out of check when in check
- ✅ Cannot castle while in check or through check
- ✅ Checkmate detection (in check with no legal moves)
- ✅ Stalemate detection (not in check but no legal moves)

#### Path Validation
- ✅ Pieces cannot jump over others (except knights)
- ✅ Captures are validated
- ✅ Blocked paths are rejected

### 6. Turn-Based Play
- ✅ AI plays one color, user plays the other
- ✅ System tracks whose turn it is
- ✅ AI automatically makes moves when it's its turn
- ✅ AI executes user moves when it's user's turn
- ❌ Cannot skip turns or move out of turn

## How to Use

### Starting a Game (AI Workflow)
1. User: "Let's play chess"
2. AI: "Would you like to play as White or Black?"
3. User: "White" (or "Black")
4. AI calls:
```javascript
{
  action: 'start',
  player_color: 'white',  // user's choice
  light_color: '#f0d9b5',  // optional
  dark_color: '#b58863',   // optional
  border_color: '#6b4c2a'  // optional
}
```
5. Response includes: `isAiTurn`, `isPlayerTurn`, `playerColor`, `aiColor`

### Making Moves (AI's Turn)
When `isAiTurn=true`, AI must:
```javascript
// 1. Check state
{ action: 'state' }

// 2. See valid moves for a piece
{ action: 'valid_moves', square: 'e7' }

// 3. Make the move
{ action: 'move', from: 'e7', to: 'e5' }
```

### Making Moves (User's Turn)
When `isPlayerTurn=true`:
1. Wait for user to say their move (e.g., "e2 to e4")
2. Execute it:
```javascript
{ action: 'move', from: 'e2', to: 'e4' }
```
3. If illegal, inform user and ask for another move

### Checking Valid Moves
```javascript
{
  action: 'valid_moves',
  square: 'e2'
}
```
Returns: `['e3', 'e4']` (list of legal destination squares)

### Getting Game State
```javascript
{
  action: 'state'
}
```
Returns: 
- `turn`: whose turn it is ('white' or 'black')
- `status`: 'playing', 'check', 'checkmate', or 'stalemate'
- `playerColor`: user's color
- `aiColor`: AI's color
- `isAiTurn`: true if AI should move now
- `isPlayerTurn`: true if waiting for user's move
- `lastMove`: previous move
- `capturedByWhite`, `capturedByBlack`: captured pieces

## Error Handling

All invalid moves return detailed error messages:

- **No color chosen**: "player_color is required for 'start' action. Ask the user: 'Would you like to play as White or Black?'"
- **Invalid notation**: "Invalid square notation: i5. Use format like 'e2', 'e4' (a-h, 1-8)."
- **Empty square**: "No piece on e3. Cannot move from empty square."
- **Wrong turn**: "It's white's turn, but e7 has a black piece. You cannot move opponent's pieces."
- **Illegal move**: "Illegal move: e2 to e5. This move violates chess rules (piece cannot move there, would leave king in check, or path is blocked). Use action='valid_moves' with square='e2' to see legal moves."
- **Game over**: "Game is over: checkmate. Cannot make more moves."

## Validation Flow

```
User/Agent calls chess_game tool
         ↓
1. Check game exists and is active
         ↓
2. Validate square notation (a1-h8)
         ↓
3. Check piece exists on source square
         ↓
4. Verify correct player's turn
         ↓
5. Generate all legal moves for current position
         ↓
6. Check if requested move is in legal moves list
         ↓
7. Execute move and update game state
         ↓
8. Detect check/checkmate/stalemate
         ↓
9. Render updated board on canvas
```

## Logging

All move attempts are logged to console:
```
[Chess] Move attempt: e2 → e4 (Player), Result: VALID, e4
[Chess] Move attempt: e7 → e5 (AI), Result: VALID, e5
[Chess] Move attempt: e2 → e5 (Player), Result: REJECTED, Illegal move: e2 to e5...
```

## Summary

The chess engine provides **complete governance** with:
- ✅ 7 layers of validation
- ✅ Official chess rules enforcement
- ✅ Turn-based play enforcement
- ✅ Check/checkmate detection
- ✅ Detailed error messages
- ✅ Move history tracking
- ✅ No bypassing validation
- ✅ AI opponent (Gemini Live agent plays strategically)
- ✅ Color selection (user chooses white or black)
- ✅ Automatic turn management

Every move is validated before execution. Invalid moves are rejected with clear error messages. The AI plays as a real opponent, making strategic decisions.
