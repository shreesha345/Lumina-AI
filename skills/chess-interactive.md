# Interactive Chess Board - User Guide

## Overview

The chess game features a fully interactive board where users can play by:
1. **Dragging and dropping pieces** with their mouse/touch
2. **Speaking moves** to the AI via voice
3. **Clicking pieces** to see valid moves, then clicking destination

The AI (Gemini Live agent) plays on the opposite side and makes moves automatically when it's its turn.

## User Interaction Methods

### Method 1: Drag and Drop (Recommended)
1. Click and hold on any of your pieces
2. Drag it to a valid destination square
3. Release to complete the move
4. The move is validated and executed automatically

**Visual Feedback:**
- Selected piece highlights in yellow
- Valid destination squares show green indicators
- Dots for empty squares, rings for captures
- Last move squares highlighted in yellow

### Method 2: Click to Select, Click to Move
1. Click on one of your pieces
2. Valid moves are highlighted with green indicators
3. Click on a highlighted square to move there
4. Click elsewhere to deselect

### Method 3: Voice Commands
1. Say your move to the AI: "e2 to e4" or "knight to f3"
2. AI executes the move for you
3. AI responds with its move

## Visual Indicators

### Square Highlights
- **Yellow**: Selected piece or last move
- **Green dot**: Valid empty square to move to
- **Green ring**: Valid capture square
- **Red**: King in check

### Piece Appearance
- **White pieces**: Light colored with shadow
- **Black pieces**: Dark colored with shadow
- **Hover effect**: Pieces scale up slightly
- **Dragging**: Piece becomes semi-transparent

### Turn Indicator
- **"Your turn!"** in green: You can move
- **"AI thinking..."** in blue: AI is making its move
- **"Check!"** in red: King is in check
- **"Checkmate!"** in purple: Game over

## Game Flow

### Starting a Game
1. User: "Let's play chess!"
2. AI: "Would you like to play as White or Black?"
3. User: "White" (or "Black")
4. Interactive chess board appears on the right side of the canvas
5. If you're White, you move first; if Black, AI moves first

### During the Game

**Your Turn:**
- Board is interactive - you can drag pieces
- Only your pieces are draggable
- Invalid moves are prevented
- After your move, AI automatically makes its move

**AI's Turn:**
- Board shows "AI thinking..."
- You cannot move pieces (they're not draggable)
- AI makes its move via the chess tool
- Board updates automatically
- Then it's your turn again

### Game End
- Checkmate: Winner announced
- Stalemate: Draw announced
- Board remains visible
- You can start a new game by asking the AI

## Features

### Move Validation
- All chess rules enforced
- Cannot move into check
- Cannot move opponent's pieces
- Cannot move out of turn
- Castling, en passant, promotion all supported

### Visual Feedback
- Smooth animations
- Clear move indicators
- Captured pieces displayed below board
- Move history tracked

### Responsive Design
- Works on desktop and mobile
- Touch-friendly on tablets/phones
- Scales appropriately for screen size

## Tips for Best Experience

### For Smooth Gameplay
1. **Drag pieces** for fastest interaction
2. **Click to select** if you want to see all valid moves first
3. **Use voice** if you prefer hands-free play

### Strategic Play
1. Click a piece to see where it can move
2. Plan your moves by checking valid squares
3. Watch for check indicators
4. Keep track of captured pieces

### Combining Methods
- Drag most moves for speed
- Use voice for complex moves or when explaining strategy
- Click to explore options before committing

## Troubleshooting

### Piece Won't Drag
- Check if it's your turn (indicator at top)
- Make sure it's your color piece
- Ensure game is still in progress

### Move Not Allowed
- Piece may be pinned (would expose king to check)
- Destination may be blocked
- May be trying to move opponent's piece

### Board Not Showing
- Ask AI to start a chess game
- Make sure you chose a color (white or black)
- Check if board is hidden (look for overlay on right side)

## Keyboard Shortcuts

- **Click + Click**: Select piece, then destination
- **Drag + Drop**: Quick move
- **Voice**: Speak move naturally

## Accessibility

- High contrast piece colors
- Clear visual indicators
- Multiple input methods
- Screen reader friendly labels
- Keyboard navigation support

## Advanced Features

### Pawn Promotion
- Drag pawn to last rank
- Automatically promotes to Queen
- (Voice: specify piece type, e.g., "promote to knight")

### Castling
- Drag king two squares toward rook
- Rook automatically moves
- Only works if legal (king/rook not moved, no check, clear path)

### En Passant
- Drag pawn diagonally to empty square
- Opponent's pawn automatically captured
- Only works immediately after opponent's two-square pawn move

## Mobile/Touch Support

- **Tap piece**: Select it
- **Tap destination**: Move there
- **Drag piece**: Direct move
- **Pinch/zoom**: Not needed (board is fixed size)

## Performance

- Smooth 60fps animations
- Instant move validation
- No lag on piece dragging
- Efficient rendering

## Privacy & Data

- All moves processed locally
- No move data sent to external servers
- Game state stored in browser memory only
- Cleared when page refreshes

## Future Enhancements

Potential features (not yet implemented):
- Move undo/redo
- Game save/load
- Move history replay
- Position analysis
- Difficulty levels
- Time controls
- Multiple board themes

## Summary

The interactive chess board provides a seamless experience combining:
- ✅ Visual drag-and-drop interaction
- ✅ Voice command support
- ✅ Click-based selection
- ✅ Real-time AI opponent
- ✅ Complete rule enforcement
- ✅ Beautiful visual feedback
- ✅ Responsive design
- ✅ Accessibility features

Play chess naturally - drag pieces, speak moves, or click to select. The AI responds intelligently and plays strategically. Enjoy!
