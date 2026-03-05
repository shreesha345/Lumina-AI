import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PdfCanvasOverlayProps {
  file?: File | null;
  url?: string | null;
  title?: string;
  onClose: () => void;
  onSelectionChange?: (context: any | null) => void;
}

export default function PdfCanvasOverlay({ file, url, title, onClose, onSelectionChange }: PdfCanvasOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 80, origY: 80 });
  const [panelPos, setPanelPos] = useState({ x: 80, y: 80 });
  const [panelSize, setPanelSize] = useState(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      width: Math.max(420, Math.min(980, Math.floor(vw * 0.74))),
      height: Math.max(320, Math.min(760, Math.floor(vh * 0.78))),
    };
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const resizeRef = useRef({
    resizing: false,
    dir: "",
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    startLeft: 0,
    startTop: 0,
  });

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setObjectUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(null);
    }
  }, [onSelectionChange]);

  const sourceUrl = useMemo(() => {
    if (url) return url;
    return objectUrl;
  }, [objectUrl, url]);

  const fileLabel = useMemo(() => {
    if (title) return title;
    if (file?.name) return file.name;
    if (!url) return "Document Viewer";
    try {
      const u = new URL(url);
      return u.hostname + u.pathname;
    } catch {
      return url;
    }
  }, [file?.name, title, url]);

  const beginDrag = useCallback((e: React.MouseEvent) => {
    if (resizeRef.current.resizing) return;
    if (!panelRef.current) return;
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: panelPos.x,
      origY: panelPos.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const maxX = Math.max(0, window.innerWidth - panelSize.width - 8);
      const maxY = Math.max(0, window.innerHeight - panelSize.height - 8);
      setPanelPos({
        x: Math.min(maxX, Math.max(0, dragRef.current.origX + dx)),
        y: Math.min(maxY, Math.max(0, dragRef.current.origY + dy)),
      });
    };

    const onUp = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelPos.x, panelPos.y, panelSize.height, panelSize.width]);

  const beginResize = useCallback((dir: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    resizeRef.current = {
      resizing: true,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: panelSize.width,
      startH: panelSize.height,
      startLeft: panelPos.x,
      startTop: panelPos.y,
    };

    const MIN_W = 360;
    const MIN_H = 260;
    const PAD = 8;

    const onMove = (ev: MouseEvent) => {
      const r = resizeRef.current;
      if (!r.resizing) return;
      const dx = ev.clientX - r.startX;
      const dy = ev.clientY - r.startY;

      let nextW = r.startW;
      let nextH = r.startH;
      let nextX = r.startLeft;
      let nextY = r.startTop;

      if (r.dir.includes("e")) {
        nextW = Math.max(MIN_W, r.startW + dx);
      }
      if (r.dir.includes("s")) {
        nextH = Math.max(MIN_H, r.startH + dy);
      }
      if (r.dir.includes("w")) {
        const candidate = r.startW - dx;
        nextW = Math.max(MIN_W, candidate);
        nextX = r.startLeft + (r.startW - nextW);
      }
      if (r.dir.includes("n")) {
        const candidate = r.startH - dy;
        nextH = Math.max(MIN_H, candidate);
        nextY = r.startTop + (r.startH - nextH);
      }

      // Keep the panel inside viewport while resizing.
      if (nextX < PAD) {
        const diff = PAD - nextX;
        nextX = PAD;
        nextW = Math.max(MIN_W, nextW - diff);
      }
      if (nextY < PAD) {
        const diff = PAD - nextY;
        nextY = PAD;
        nextH = Math.max(MIN_H, nextH - diff);
      }

      const maxW = Math.max(MIN_W, window.innerWidth - nextX - PAD);
      const maxH = Math.max(MIN_H, window.innerHeight - nextY - PAD);
      nextW = Math.min(nextW, maxW);
      nextH = Math.min(nextH, maxH);

      setPanelPos({ x: nextX, y: nextY });
      setPanelSize({ width: nextW, height: nextH });
    };

    const onUp = () => {
      resizeRef.current.resizing = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelPos.x, panelPos.y, panelSize.height, panelSize.width]);

  return (
    <div
      ref={panelRef}
      className="pdf-overlay-panel"
      style={{ left: panelPos.x, top: panelPos.y, width: panelSize.width, height: panelSize.height }}
    >
      <div className="pdf-overlay-header" onMouseDown={beginDrag}>
        <span className="pdf-overlay-title">{fileLabel}</span>
        <div className="pdf-overlay-actions">
          {sourceUrl && (
            <a className="pdf-overlay-open" href={sourceUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          )}
          <button className="pdf-overlay-close" onClick={onClose} title="Close PDF panel">x</button>
        </div>
      </div>

      <div className="pdf-browser-shell">
        {sourceUrl ? (
          <iframe
            className="pdf-view-iframe"
            src={sourceUrl}
            title={fileLabel}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="pdf-view-empty">No document to show.</div>
        )}
      </div>

      {[
        "n", "s", "e", "w", "nw", "ne", "sw", "se",
      ].map((dir) => (
        <div
          key={dir}
          className={`pdf-resize-handle pdf-resize-${dir}`}
          onMouseDown={(e) => beginResize(dir, e)}
        />
      ))}
    </div>
  );
}
