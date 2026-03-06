import { useEffect, useState, useCallback, useRef } from 'react';
import * as Chess from '../services/chessEngine';
import './ChessBoard.css';

interface ChessBoardProps {
  onUserMove?: (from: string, to: string) => void;
}

const PIECE_UNICODE: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};

const FILES = 'abcdefgh';

export default function ChessBoard({ onUserMove }: ChessBoardProps) {
  const [gameState, setGameState] = useState<Chess.GameState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [draggedPiece, setDraggedPiece] = useState<{ square: string; piece: Chess.Piece } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Listen for game state updates from the chess engine
  useEffect(() => {
    const updateBoard = () => {
      const state = Chess.getState();
      setGameState(state);
    };

    // Initial load
    updateBoard();

    // Listen for custom events when board updates
    window.addEventListener('chess-board-updated', updateBoard);
    return () => window.removeEventListener('chess-board-updated', updateBoard);
  }, []);

  const toSquare = (row: number, col: number): string => {
    return FILES[col] + (8 - row);
  };

  const parseSquare = (sq: string): { row: number; col: number } | null => {
    if (!sq || sq.length !== 2) return null;
    const col = FILES.indexOf(sq[0].toLowerCase());
    const row = 8 - parseInt(sq[1]);
    if (col < 0 || col > 7 || row < 0 || row > 7 || isNaN(row)) return null;
    return { row, col };
  };

  const handleSquareClick = useCallback((square: string) => {
    if (!gameState) return;

    const playerColor = Chess.getPlayerColor();
    const isPlayerTurn = Chess.isPlayerTurn();

    // Only allow interaction on player's turn
    if (!isPlayerTurn) {
      console.log('[ChessBoard] Not player\'s turn');
      return;
    }

    const pos = parseSquare(square);
    if (!pos) return;

    const piece = gameState.board[pos.row][pos.col];

    // If a piece is already selected
    if (selectedSquare) {
      // Try to move to this square
      if (validMoves.includes(square)) {
        // Valid move - execute it
        const result = Chess.makeMove(selectedSquare, square);
        if (result.ok) {
          setGameState(result.state);
          setSelectedSquare(null);
          setValidMoves([]);
          
          // Notify parent component (which will tell the AI)
          if (onUserMove) {
            onUserMove(selectedSquare, square);
          }

          // Dispatch event for other components
          window.dispatchEvent(new CustomEvent('chess-board-updated'));
        } else {
          console.error('[ChessBoard] Move failed:', result.error);
        }
      } else {
        // Clicked on another piece of the same color - select it instead
        if (piece && piece.color === playerColor) {
          setSelectedSquare(square);
          const moves = Chess.getValidMoves(square);
          setValidMoves(moves);
        } else {
          // Clicked on invalid square - deselect
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else {
      // No piece selected - select this piece if it's player's
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        const moves = Chess.getValidMoves(square);
        setValidMoves(moves);
      }
    }
  }, [gameState, selectedSquare, validMoves, onUserMove]);

  const handleDragStart = useCallback((e: React.DragEvent, square: string) => {
    if (!gameState) return;

    const playerColor = Chess.getPlayerColor();
    const isPlayerTurn = Chess.isPlayerTurn();

    if (!isPlayerTurn) {
      e.preventDefault();
      return;
    }

    const pos = parseSquare(square);
    if (!pos) return;

    const piece = gameState.board[pos.row][pos.col];
    if (!piece || piece.color !== playerColor) {
      e.preventDefault();
      return;
    }

    setDraggedPiece({ square, piece });
    setSelectedSquare(square);
    const moves = Chess.getValidMoves(square);
    setValidMoves(moves);

    // Set drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = PIECE_UNICODE[(piece.color === 'white' ? 'w' : 'b') + piece.type];
    dragImage.style.fontSize = '44px';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 22, 22);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, [gameState]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSquare: string) => {
    e.preventDefault();
    
    if (!draggedPiece) return;

    const fromSquare = draggedPiece.square;
    
    if (validMoves.includes(targetSquare)) {
      const result = Chess.makeMove(fromSquare, targetSquare);
      if (result.ok) {
        setGameState(result.state);
        
        // Notify parent component
        if (onUserMove) {
          onUserMove(fromSquare, targetSquare);
        }

        // Dispatch event
        window.dispatchEvent(new CustomEvent('chess-board-updated'));
      }
    }

    setDraggedPiece(null);
    setSelectedSquare(null);
    setValidMoves([]);
  }, [draggedPiece, validMoves, onUserMove]);

  const handleDragEnd = useCallback(() => {
    setDraggedPiece(null);
    setSelectedSquare(null);
    setValidMoves([]);
  }, []);

  if (!gameState) {
    return (
      <div className="chess-board-container">
        <div className="chess-board-placeholder">
          <p>No chess game in progress</p>
          <p>Ask the AI to start a chess game!</p>
        </div>
      </div>
    );
  }

  const playerColor = Chess.getPlayerColor();
  const isPlayerTurn = Chess.isPlayerTurn();
  const isAiTurn = Chess.isAiTurn();

  return (
    <div className="chess-board-container" ref={boardRef}>
      <div className="chess-board-header">
        <h3>Chess</h3>
        <div className="chess-turn-indicator">
          {gameState.status === 'checkmate' ? (
            <span className="game-over">Checkmate! {gameState.winner} wins!</span>
          ) : gameState.status === 'stalemate' ? (
            <span className="game-over">Stalemate - Draw!</span>
          ) : gameState.status === 'check' ? (
            <span className="check">Check! {gameState.turn} to move</span>
          ) : (
            <span>
              {gameState.turn === 'white' ? '⚪' : '⚫'} {gameState.turn} to move
              {isPlayerTurn && <span className="your-turn"> (Your turn!)</span>}
              {isAiTurn && <span className="ai-turn"> (AI thinking...)</span>}
            </span>
          )}
        </div>
      </div>

      <div className="chess-board">
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="chess-row">
            {Array.from({ length: 8 }).map((_, col) => {
              const square = toSquare(row, col);
              const piece = gameState.board[row][col];
              const isLight = (row + col) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isValidMove = validMoves.includes(square);
              const isLastMoveSquare = 
                gameState.lastMove?.from === square || 
                gameState.lastMove?.to === square;

              return (
                <div
                  key={square}
                  className={`chess-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''}`}
                  onClick={() => handleSquareClick(square)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, square)}
                >
                  <div className="square-label">
                    {col === 0 && <span className="rank-label">{8 - row}</span>}
                    {row === 7 && <span className="file-label">{FILES[col]}</span>}
                  </div>
                  
                  {piece && (
                    <div
                      className={`chess-piece ${piece.color} ${draggedPiece?.square === square ? 'dragging' : ''}`}
                      draggable={isPlayerTurn && piece.color === playerColor}
                      onDragStart={(e) => handleDragStart(e, square)}
                      onDragEnd={handleDragEnd}
                    >
                      {PIECE_UNICODE[(piece.color === 'white' ? 'w' : 'b') + piece.type]}
                    </div>
                  )}
                  
                  {isValidMove && !piece && (
                    <div className="move-indicator dot" />
                  )}
                  {isValidMove && piece && (
                    <div className="move-indicator capture" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="chess-board-footer">
        <div className="captured-pieces">
          <div className="captured-by-white">
            <span className="label">Captured by White:</span>
            {gameState.capturedByWhite.map((type, i) => (
              <span key={i} className="captured-piece">
                {PIECE_UNICODE['b' + type]}
              </span>
            ))}
          </div>
          <div className="captured-by-black">
            <span className="label">Captured by Black:</span>
            {gameState.capturedByBlack.map((type, i) => (
              <span key={i} className="captured-piece">
                {PIECE_UNICODE['w' + type]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
