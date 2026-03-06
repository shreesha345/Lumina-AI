# Voice Controls Update

## Changes Made

The voice control system has been updated to make push-to-talk the default mode, with hands-free as an optional toggle.

## New Behavior

### Default Mode: Push-to-Talk
- **Hold mouse button** on the microphone icon to record
- **Hold Ctrl+Space** to record via keyboard
- Release to stop recording and send
- This is the default mode when you start the app

### Optional Mode: Hands-free
- **Press Ctrl+H** to toggle hands-free mode on/off
- When enabled, the AI is always listening
- No need to hold any buttons
- Press Ctrl+H again to return to push-to-talk mode

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Space** (hold) | Push-to-talk: Record while held |
| **Ctrl+H** | Toggle hands-free mode on/off |

## Mouse Controls

| Action | Result |
|--------|--------|
| **Hold microphone button** | Record (push-to-talk) |
| **Release microphone button** | Stop recording and send |
| **Hover over mic button** | See menu to toggle hands-free |

## Visual Indicators

### Button States

**Push-to-Talk Mode (Default):**
- Idle: "Push to Talk"
- Recording: "Recording..." (with pulse animation)
- Processing: "Processing..." (with spinner)
- AI Speaking: "AI Speaking..." (with pulse)

**Hands-Free Mode:**
- Idle: "Hands-free Active"
- Listening: "Listening..." (with pulse)
- Processing: "Processing..." (with spinner)
- AI Speaking: "AI Speaking..." (with pulse)

### Tooltip Messages

**Push-to-Talk Mode:**
> "Push-to-talk: Hold button or Ctrl+Space to speak. Toggle hands-free: Ctrl+H"

**Hands-Free Mode:**
> "Hands-free mode: always listening (Ctrl+H to disable)"

## Usage Examples

### Example 1: Quick Question (Push-to-Talk)
1. Hold microphone button (or Ctrl+Space)
2. Ask: "What's the weather today?"
3. Release button
4. AI responds

### Example 2: Long Conversation (Hands-Free)
1. Press Ctrl+H to enable hands-free
2. Just talk naturally - no need to hold buttons
3. AI responds to each question
4. Press Ctrl+H when done to return to push-to-talk

### Example 3: Playing Chess
1. Use push-to-talk for moves: Hold button, say "e2 to e4", release
2. Or switch to hands-free for natural conversation during the game
3. Drag pieces on the board while talking

## Benefits

### Push-to-Talk (Default)
- ✅ More control over when you're recording
- ✅ Prevents accidental recordings
- ✅ Clear start/stop points
- ✅ Better for noisy environments
- ✅ Privacy-friendly (only records when you want)

### Hands-Free (Optional)
- ✅ Natural conversation flow
- ✅ No need to hold buttons
- ✅ Great for long discussions
- ✅ Hands free for other tasks
- ✅ Easy toggle with Ctrl+H

## Technical Details

### Removed Features
- ❌ Click-to-toggle mode (was confusing)
- ❌ 300ms hold delay (now instant)
- ❌ Complex state management

### Simplified Logic
- ✅ Two clear modes: push-to-talk and hands-free
- ✅ Instant response on button press
- ✅ Simple toggle with Ctrl+H
- ✅ Clear visual feedback

## Migration Notes

If you were using the old click-to-toggle behavior:
- **Old**: Click to start, click to stop
- **New**: Hold to record, release to send (push-to-talk)
- **Alternative**: Use Ctrl+H for hands-free mode

## Troubleshooting

**Recording doesn't start:**
- Make sure you're holding the button (not just clicking)
- Or use Ctrl+Space keyboard shortcut
- Check if hands-free mode is enabled (Ctrl+H)

**Can't stop recording:**
- Release the mouse button or Ctrl+Space
- In hands-free mode, recording is continuous (toggle off with Ctrl+H)

**Accidental recordings:**
- Use push-to-talk mode (default)
- Disable hands-free mode if enabled (Ctrl+H)

## Summary

Voice controls are now simpler and more intuitive:
- **Default**: Push-to-talk (hold to record)
- **Optional**: Hands-free (Ctrl+H to toggle)
- **Keyboard**: Ctrl+Space for push-to-talk, Ctrl+H for hands-free toggle
- **Clear feedback**: Visual indicators show current mode and state

Enjoy the improved voice control experience! 🎤
