// ─── Chess Engine ───
// Full chess game: state management, move validation, AI moves, SVG board rendering.

// ========== Types ==========

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type Color = 'white' | 'black';
export interface Piece { type: PieceType; color: Color; }
export type Board = (Piece | null)[][];

export interface GameState {
    board: Board;
    turn: Color;
    castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
    enPassant: string | null;
    lastMove: { from: string; to: string } | null;
    history: { from: string; to: string; notation: string; captured: PieceType | null }[];
    capturedByWhite: PieceType[];
    capturedByBlack: PieceType[];
    status: 'playing' | 'check' | 'checkmate' | 'stalemate';
    winner: Color | null;
    moveNumber: number;
}

// ========== Constants ==========

const PIECE_UNICODE: Record<string, string> = {
    wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
    bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};
const PIECE_VALUES: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
const FILES = 'abcdefgh';

// ========== Module State ==========

let gameState: GameState | null = null;
let boardElementId: string | null = null;
let boardColors = { light: '#f0d9b5', dark: '#b58863', border: '#6b4c2a' };

// ========== Coordinate Helpers ==========

function parseSq(s: string): { r: number; c: number } | null {
    if (!s || s.length !== 2) return null;
    const c = FILES.indexOf(s[0].toLowerCase());
    const r = 8 - parseInt(s[1]);
    if (c < 0 || c > 7 || r < 0 || r > 7 || isNaN(r)) return null;
    return { r, c };
}

function toSq(r: number, c: number): string { return FILES[c] + (8 - r); }
function inB(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function cloneBoard(b: Board): Board { return b.map(row => row.map(p => p ? { ...p } : null)); }

// ========== Board Init ==========

function createBoard(): Board {
    const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
        b[0][c] = { type: back[c], color: 'black' };
        b[1][c] = { type: 'P', color: 'black' };
        b[6][c] = { type: 'P', color: 'white' };
        b[7][c] = { type: back[c], color: 'white' };
    }
    return b;
}

function newGameState(): GameState {
    return {
        board: createBoard(), turn: 'white',
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        enPassant: null, lastMove: null, history: [],
        capturedByWhite: [], capturedByBlack: [],
        status: 'playing', winner: null, moveNumber: 1,
    };
}

// ========== Move Generation ==========

function slide(b: Board, r: number, c: number, dr: number, dc: number, col: Color): { r: number; c: number }[] {
    const m: { r: number; c: number }[] = [];
    let nr = r + dr, nc = c + dc;
    while (inB(nr, nc)) {
        const t = b[nr][nc];
        if (!t) { m.push({ r: nr, c: nc }); }
        else { if (t.color !== col) m.push({ r: nr, c: nc }); break; }
        nr += dr; nc += dc;
    }
    return m;
}

function rawMoves(b: Board, r: number, c: number, ep: string | null): { r: number; c: number }[] {
    const p = b[r][c];
    if (!p) return [];
    const m: { r: number; c: number }[] = [];
    const { type, color } = p;

    if (type === 'P') {
        const dir = color === 'white' ? -1 : 1;
        const start = color === 'white' ? 6 : 1;
        if (inB(r + dir, c) && !b[r + dir][c]) {
            m.push({ r: r + dir, c });
            if (r === start && !b[r + 2 * dir][c]) m.push({ r: r + 2 * dir, c });
        }
        for (const dc of [-1, 1]) {
            const nr = r + dir, nc = c + dc;
            if (!inB(nr, nc)) continue;
            if (b[nr][nc] && b[nr][nc]!.color !== color) m.push({ r: nr, c: nc });
            if (ep && toSq(nr, nc) === ep) m.push({ r: nr, c: nc });
        }
    } else if (type === 'N') {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (inB(nr, nc) && (!b[nr][nc] || b[nr][nc]!.color !== color)) m.push({ r: nr, c: nc });
        }
    } else if (type === 'K') {
        for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (inB(nr, nc) && (!b[nr][nc] || b[nr][nc]!.color !== color)) m.push({ r: nr, c: nc });
        }
    } else {
        const dirs = type === 'R' ? [[0, 1], [0, -1], [1, 0], [-1, 0]] :
            type === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] :
                [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of dirs) m.push(...slide(b, r, c, dr, dc, color));
    }
    return m;
}

// ========== Check Detection ==========

function findKing(b: Board, col: Color): { r: number; c: number } | null {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
        if (b[r][c]?.type === 'K' && b[r][c]?.color === col) return { r, c };
    return null;
}

function isAttacked(b: Board, tr: number, tc: number, by: Color): boolean {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (!b[r][c] || b[r][c]!.color !== by) continue;
        if (rawMoves(b, r, c, null).some(m => m.r === tr && m.c === tc)) return true;
    }
    return false;
}

function inCheck(b: Board, col: Color): boolean {
    const k = findKing(b, col);
    return k ? isAttacked(b, k.r, k.c, col === 'white' ? 'black' : 'white') : false;
}

function wouldCheck(b: Board, fr: number, fc: number, tr: number, tc: number, col: Color): boolean {
    const nb = cloneBoard(b);
    nb[tr][tc] = nb[fr][fc]; nb[fr][fc] = null;
    return inCheck(nb, col);
}

// ========== Legal Moves ==========

function legalMoves(st: GameState, r: number, c: number): { r: number; c: number }[] {
    const p = st.board[r][c];
    if (!p || p.color !== st.turn) return [];
    return rawMoves(st.board, r, c, st.enPassant).filter(m => !wouldCheck(st.board, r, c, m.r, m.c, p.color));
}

function castlingMoves(st: GameState): { from: string; to: string }[] {
    const ms: { from: string; to: string }[] = [];
    const { board, turn, castling } = st;
    const enemy = turn === 'white' ? 'black' : 'white';
    const row = turn === 'white' ? 7 : 0;
    if (inCheck(board, turn)) return ms;
    const kSide = turn === 'white' ? castling.wK : castling.bK;
    const qSide = turn === 'white' ? castling.wQ : castling.bQ;
    if (kSide && !board[row][5] && !board[row][6] &&
        !isAttacked(board, row, 5, enemy) && !isAttacked(board, row, 6, enemy))
        ms.push({ from: toSq(row, 4), to: toSq(row, 6) });
    if (qSide && !board[row][3] && !board[row][2] && !board[row][1] &&
        !isAttacked(board, row, 3, enemy) && !isAttacked(board, row, 2, enemy))
        ms.push({ from: toSq(row, 4), to: toSq(row, 2) });
    return ms;
}

function allLegalMoves(st: GameState): { from: string; to: string }[] {
    const ms: { from: string; to: string }[] = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (!st.board[r][c] || st.board[r][c]!.color !== st.turn) continue;
        for (const m of legalMoves(st, r, c)) ms.push({ from: toSq(r, c), to: toSq(m.r, m.c) });
    }
    ms.push(...castlingMoves(st));
    return ms;
}

// ========== Execute Move ==========

function execMove(st: GameState, from: string, to: string, promo: PieceType = 'Q'): GameState {
    const f = parseSq(from)!, t = parseSq(to)!;
    const ns: GameState = {
        ...st, board: cloneBoard(st.board),
        history: [...st.history],
        capturedByWhite: [...st.capturedByWhite],
        capturedByBlack: [...st.capturedByBlack],
    };
    const piece = ns.board[f.r][f.c]!;
    const captured = ns.board[t.r][t.c];
    let isEp = false;

    // Captures
    if (captured) {
        (piece.color === 'white' ? ns.capturedByWhite : ns.capturedByBlack).push(captured.type);
    }
    // En passant capture
    if (piece.type === 'P' && st.enPassant && toSq(t.r, t.c) === st.enPassant) {
        const epR = piece.color === 'white' ? t.r + 1 : t.r - 1;
        const epP = ns.board[epR][t.c];
        if (epP) (piece.color === 'white' ? ns.capturedByWhite : ns.capturedByBlack).push(epP.type);
        ns.board[epR][t.c] = null;
        isEp = true;
    }
    // Move piece
    ns.board[t.r][t.c] = piece;
    ns.board[f.r][f.c] = null;
    // Promotion
    if (piece.type === 'P' && (t.r === 0 || t.r === 7))
        ns.board[t.r][t.c] = { type: promo, color: piece.color };
    // Castling
    if (piece.type === 'K' && Math.abs(f.c - t.c) === 2) {
        if (t.c === 6) { ns.board[f.r][5] = ns.board[f.r][7]; ns.board[f.r][7] = null; }
        else if (t.c === 2) { ns.board[f.r][3] = ns.board[f.r][0]; ns.board[f.r][0] = null; }
    }
    // Update castling rights
    if (piece.type === 'K') {
        if (piece.color === 'white') { ns.castling.wK = false; ns.castling.wQ = false; }
        else { ns.castling.bK = false; ns.castling.bQ = false; }
    }
    if (piece.type === 'R') {
        if (f.r === 7 && f.c === 7) ns.castling.wK = false;
        if (f.r === 7 && f.c === 0) ns.castling.wQ = false;
        if (f.r === 0 && f.c === 7) ns.castling.bK = false;
        if (f.r === 0 && f.c === 0) ns.castling.bQ = false;
    }
    if (t.r === 7 && t.c === 7) ns.castling.wK = false;
    if (t.r === 7 && t.c === 0) ns.castling.wQ = false;
    if (t.r === 0 && t.c === 7) ns.castling.bK = false;
    if (t.r === 0 && t.c === 0) ns.castling.bQ = false;
    // En passant target
    ns.enPassant = (piece.type === 'P' && Math.abs(f.r - t.r) === 2) ? toSq((f.r + t.r) / 2, f.c) : null;
    // Notation
    let nota = '';
    if (piece.type === 'K' && t.c - f.c === 2) nota = 'O-O';
    else if (piece.type === 'K' && f.c - t.c === 2) nota = 'O-O-O';
    else {
        if (piece.type !== 'P') nota += piece.type;
        if (captured || isEp) { if (piece.type === 'P') nota += FILES[f.c]; nota += 'x'; }
        nota += to;
        if (piece.type === 'P' && (t.r === 0 || t.r === 7)) nota += '=' + promo;
    }
    // Turn switch
    ns.turn = st.turn === 'white' ? 'black' : 'white';
    ns.lastMove = { from, to };
    if (st.turn === 'black') ns.moveNumber = st.moveNumber + 1;
    // Status
    const chk = inCheck(ns.board, ns.turn);
    const hasM = allLegalMoves(ns).length > 0;
    if (chk && !hasM) { ns.status = 'checkmate'; ns.winner = st.turn; nota += '#'; }
    else if (chk) { ns.status = 'check'; nota += '+'; }
    else if (!hasM) { ns.status = 'stalemate'; }
    else ns.status = 'playing';

    ns.history.push({ from, to, notation: nota, captured: captured?.type || null });
    return ns;
}

// ========== AI Move ==========

function evalBoard(b: Board): number {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = b[r][c]; if (!p) continue;
        const v = PIECE_VALUES[p.type];
        s += p.color === 'white' ? v : -v;
        // Center bonus
        const cd = Math.abs(3.5 - r) + Math.abs(3.5 - c);
        s += (p.color === 'white' ? 1 : -1) * (7 - cd) * 0.05;
    }
    return s;
}

function pickAiMove(st: GameState): { from: string; to: string } | null {
    const moves = allLegalMoves(st);
    if (moves.length === 0) return null;
    let best = moves[0], bestScore = st.turn === 'white' ? -Infinity : Infinity;
    for (const mv of moves) {
        const ns = execMove(st, mv.from, mv.to);
        const sc = evalBoard(ns.board) + (Math.random() - 0.5) * 0.3;
        if (ns.status === 'checkmate') return mv; // instant win
        if (st.turn === 'white' ? sc > bestScore : sc < bestScore) { bestScore = sc; best = mv; }
    }
    return best;
}

// ========== SVG Rendering ==========

export function renderSvg(st: GameState, highlights?: string[]): string {
    const L = boardColors.light, D = boardColors.dark, SQ = 60, O = 40;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 600">`;
    // Board bg
    s += `<rect x="32" y="32" width="496" height="496" rx="6" fill="${boardColors.border}"/>`;
    // Title
    let title = 'Chess';
    if (st.status === 'checkmate') title = `Checkmate! ${st.winner === 'white' ? 'White' : 'Black'} wins!`;
    else if (st.status === 'stalemate') title = 'Stalemate — Draw!';
    else if (st.status === 'check') title = `${st.turn === 'white' ? 'White' : 'Black'} in Check!`;
    s += `<text x="280" y="22" font-size="18" fill="#4a3728" font-family="Georgia,serif" font-weight="bold" text-anchor="middle">${title}</text>`;
    // Squares
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        s += `<rect x="${O + c * SQ}" y="${O + r * SQ}" width="${SQ}" height="${SQ}" fill="${(r + c) % 2 === 0 ? L : D}"/>`;
    }
    // Last move highlights
    if (st.lastMove) for (const sq of [st.lastMove.from, st.lastMove.to]) {
        const p = parseSq(sq);
        if (p) s += `<rect x="${O + p.c * SQ}" y="${O + p.r * SQ}" width="${SQ}" height="${SQ}" fill="rgba(255,255,0,0.4)"/>`;
    }
    // Check highlight
    if (st.status === 'check' || st.status === 'checkmate') {
        const k = findKing(st.board, st.turn);
        if (k) s += `<rect x="${O + k.c * SQ}" y="${O + k.r * SQ}" width="${SQ}" height="${SQ}" fill="rgba(255,0,0,0.4)"/>`;
    }
    // Valid move highlights
    if (highlights) for (const sq of highlights) {
        const p = parseSq(sq);
        if (!p) continue;
        const cx = O + p.c * SQ + SQ / 2, cy = O + p.r * SQ + SQ / 2;
        if (st.board[p.r][p.c]) s += `<circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="rgba(0,150,0,0.6)" stroke-width="4"/>`;
        else s += `<circle cx="${cx}" cy="${cy}" r="10" fill="rgba(0,150,0,0.5)"/>`;
    }
    // Pieces
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const pc = st.board[r][c]; if (!pc) continue;
        const sym = PIECE_UNICODE[(pc.color === 'white' ? 'w' : 'b') + pc.type];
        const fill = pc.color === 'white' ? '#fff' : '#1a1a1a';
        const stroke = pc.color === 'white' ? '#333' : '#666';
        s += `<text x="${O + c * SQ + SQ / 2}" y="${O + r * SQ + SQ / 2 + 2}" font-size="44" text-anchor="middle" dominant-baseline="central" fill="${fill}" stroke="${stroke}" stroke-width="0.5">${sym}</text>`;
    }
    // File labels
    for (let c = 0; c < 8; c++)
        s += `<text x="${O + c * SQ + SQ / 2}" y="${O + 8 * SQ + 18}" font-size="14" fill="#8b7355" font-weight="bold" text-anchor="middle" font-family="Arial,sans-serif">${FILES[c]}</text>`;
    // Rank labels
    for (let r = 0; r < 8; r++)
        s += `<text x="${O - 14}" y="${O + r * SQ + SQ / 2 + 5}" font-size="14" fill="#8b7355" font-weight="bold" text-anchor="middle" font-family="Arial,sans-serif">${8 - r}</text>`;
    // Status
    let stTxt = st.turn === 'white' ? 'White to move' : 'Black to move';
    if (st.status === 'checkmate') stTxt = `Checkmate! ${st.winner === 'white' ? 'White' : 'Black'} wins!`;
    else if (st.status === 'stalemate') stTxt = 'Stalemate — Draw!';
    else if (st.status === 'check') stTxt += ' (Check!)';
    s += `<text x="280" y="${O + 8 * SQ + 42}" font-size="16" fill="#333" font-weight="bold" text-anchor="middle" font-family="Arial,sans-serif">${stTxt}</text>`;
    // Captured
    const cw = st.capturedByWhite.map(t => PIECE_UNICODE['b' + t]).join('');
    const cb = st.capturedByBlack.map(t => PIECE_UNICODE['w' + t]).join('');
    if (cw) s += `<text x="40" y="${O + 8 * SQ + 62}" font-size="20" fill="#333" font-family="Arial,sans-serif">${cw}</text>`;
    if (cb) s += `<text x="300" y="${O + 8 * SQ + 62}" font-size="20" fill="#333" font-family="Arial,sans-serif">${cb}</text>`;
    s += `</svg>`;
    return s;
}

// ========== Public API ==========

export function startGame(): GameState {
    gameState = newGameState();
    boardElementId = null;
    return gameState;
}

export function makeMove(from: string, to: string, promotion?: string): { ok: boolean; state: GameState; notation: string; error?: string } {
    if (!gameState) return { ok: false, state: newGameState(), notation: '', error: 'No game in progress. Start a game first.' };
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate')
        return { ok: false, state: gameState, notation: '', error: `Game is over: ${gameState.status}.` };

    const f = parseSq(from), t = parseSq(to);
    if (!f || !t) return { ok: false, state: gameState, notation: '', error: `Invalid square: ${!f ? from : to}` };

    const piece = gameState.board[f.r][f.c];
    if (!piece) return { ok: false, state: gameState, notation: '', error: `No piece on ${from}.` };
    if (piece.color !== gameState.turn)
        return { ok: false, state: gameState, notation: '', error: `It's ${gameState.turn}'s turn, but ${from} has a ${piece.color} piece.` };

    // Check if move is legal
    const legal = allLegalMoves(gameState);
    if (!legal.some(m => m.from === from && m.to === to))
        return { ok: false, state: gameState, notation: '', error: `Illegal move: ${from} to ${to}. Piece cannot move there.` };

    const promo: PieceType = (promotion && 'QRBN'.includes(promotion.toUpperCase())) ? promotion.toUpperCase() as PieceType : 'Q';
    gameState = execMove(gameState, from, to, promo);
    const lastEntry = gameState.history[gameState.history.length - 1];
    return { ok: true, state: gameState, notation: lastEntry.notation };
}

export function makeAiMove(): { ok: boolean; state: GameState; notation: string; from: string; to: string; error?: string } {
    if (!gameState) return { ok: false, state: newGameState(), notation: '', from: '', to: '', error: 'No game in progress.' };
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate')
        return { ok: false, state: gameState, notation: '', from: '', to: '', error: `Game is over: ${gameState.status}.` };

    const mv = pickAiMove(gameState);
    if (!mv) return { ok: false, state: gameState, notation: '', from: '', to: '', error: 'No legal moves available.' };

    gameState = execMove(gameState, mv.from, mv.to);
    const lastEntry = gameState.history[gameState.history.length - 1];
    return { ok: true, state: gameState, notation: lastEntry.notation, from: mv.from, to: mv.to };
}

export function getValidMoves(square: string): string[] {
    if (!gameState) return [];
    const pos = parseSq(square);
    if (!pos) return [];
    const piece = gameState.board[pos.r][pos.c];
    if (!piece || piece.color !== gameState.turn) return [];
    const ms = legalMoves(gameState, pos.r, pos.c).map(m => toSq(m.r, m.c));
    // Add castling if king
    if (piece.type === 'K') {
        const cm = castlingMoves(gameState).filter(m => m.from === square);
        ms.push(...cm.map(m => m.to));
    }
    return ms;
}

export function getState(): GameState | null { return gameState; }
export function resetGame(): GameState { return startGame(); }
export function getBoardElementId(): string | null { return boardElementId; }
export function setBoardElementId(id: string) { boardElementId = id; }
export function clearBoardElementId() { boardElementId = null; }
export function setBoardColors(light?: string, dark?: string, border?: string) {
    if (light) boardColors.light = light;
    if (dark) boardColors.dark = dark;
    if (border) boardColors.border = border;
}
export function getBoardColors() { return { ...boardColors }; }
