import React, { useState, useCallback, useRef } from 'react';
import { Grid3X3 } from 'lucide-react';

interface SpreadsheetPasteAreaProps {
  onDataPaste: (text: string) => void;
  onDataChange?: (hasData: boolean, rawText: string) => void;
}

export function SpreadsheetPasteArea({ onDataPaste }: SpreadsheetPasteAreaProps) {
  const [cells, setCells] = useState<string[][]>([['']]);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [resizing, setResizing] = useState<{ colIndex: number; startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const minRows = 5;
  const minCols = 4;
  const defaultColWidth = 120;
  const minColWidth = 60;

  const displayCells = useCallback(() => {
    const result: string[][] = [];
    const maxRows = Math.max(cells.length, minRows);
    const maxCols = Math.max(cells.reduce((max, row) => Math.max(max, row.length), 0), minCols);
    
    for (let i = 0; i < maxRows; i++) {
      const row: string[] = [];
      for (let j = 0; j < maxCols; j++) {
        row.push(cells[i]?.[j] || '');
      }
      result.push(row);
    }
    return result;
  }, [cells]);

  const grid = displayCells();

  // Ensure columnWidths array matches grid columns
  const getColumnWidth = (colIndex: number): number => {
    return columnWidths[colIndex] ?? defaultColWidth;
  };

  const handleResizeStart = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startWidth = getColumnWidth(colIndex);
    setResizing({
      colIndex,
      startX: e.clientX,
      startWidth,
    });

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;

    const delta = e.clientX - resizing.startX;
    const newWidth = Math.max(minColWidth, resizing.startWidth + delta);
    
    setColumnWidths(prev => {
      const newWidths = [...prev];
      // Ensure array is long enough
      while (newWidths.length <= resizing.colIndex) {
        newWidths.push(defaultColWidth);
      }
      newWidths[resizing.colIndex] = newWidth;
      return newWidths;
    });
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add global mouse event listeners for resizing
  React.useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    
    if (!text.trim()) return;

    const lines = text.split('\n').filter(line => line.trim());
    const newCells = lines.map(line => {
      const delimiter = line.includes('\t') ? '\t' : ',';
      return line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
    });

    setCells(newCells);
    
    // Reset column widths for new data
    const maxCols = Math.max(...newCells.map(row => row.length), minCols);
    setColumnWidths(new Array(maxCols).fill(defaultColWidth));
    
    onDataPaste(text);
  }, [onDataPaste]);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newCells = [...cells];
    
    while (newCells.length <= rowIndex) {
      newCells.push([]);
    }
    
    while (newCells[rowIndex].length <= colIndex) {
      newCells[rowIndex].push('');
    }
    
    newCells[rowIndex][colIndex] = value;
    setCells(newCells);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = colIndex + 1;
      if (nextCol < grid[0].length) {
        setFocusedCell({ row: rowIndex, col: nextCol });
      } else if (rowIndex + 1 < grid.length) {
        setFocusedCell({ row: rowIndex + 1, col: 0 });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex + 1 < grid.length) {
        setFocusedCell({ row: rowIndex + 1, col: colIndex });
      }
    } else if (e.key === 'ArrowDown' && rowIndex + 1 < grid.length) {
      setFocusedCell({ row: rowIndex + 1, col: colIndex });
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      setFocusedCell({ row: rowIndex - 1, col: colIndex });
    } else if (e.key === 'ArrowRight' && colIndex + 1 < grid[0].length) {
      setFocusedCell({ row: rowIndex, col: colIndex + 1 });
    } else if (e.key === 'ArrowLeft' && colIndex > 0) {
      setFocusedCell({ row: rowIndex, col: colIndex - 1 });
    }
  };

  const hasData = cells.some(row => row.some(cell => cell.trim() !== ''));

  return (
    <div 
      ref={containerRef}
      className="relative rounded-xl border border-border/50 bg-muted/30 overflow-hidden"
      onPaste={handlePaste}
    >
      {/* Header hint */}
      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-muted/50">
          <Grid3X3 className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">Clique aqui e cole (Ctrl+V) dados da planilha</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Os dados serão organizados automaticamente</p>
        </div>
      )}

      {/* Spreadsheet Grid */}
      <div className="overflow-auto max-h-64 scrollbar-thin" tabIndex={0}>
        <table ref={tableRef} className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80">
              <th 
                className="px-2 py-2 text-xs text-muted-foreground border-r border-b border-border/30 bg-muted/90"
                style={{ width: 40, minWidth: 40 }}
              >
                #
              </th>
              {grid[0].map((_, colIndex) => (
                <th 
                  key={colIndex}
                  className="relative px-3 py-2 text-xs font-medium text-muted-foreground border-r border-b border-border/30 bg-muted/90 select-none"
                  style={{ width: getColumnWidth(colIndex), minWidth: minColWidth }}
                >
                  {String.fromCharCode(65 + colIndex)}
                  
                  {/* Resize Handle */}
                  <div
                    className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group hover:bg-primary/50 transition-colors ${
                      resizing?.colIndex === colIndex ? 'bg-primary' : ''
                    }`}
                    onMouseDown={(e) => handleResizeStart(e, colIndex)}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary/0 group-hover:bg-primary transition-colors" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/20">
                <td 
                  className="px-2 py-1 text-xs text-muted-foreground text-center border-r border-b border-border/30 bg-muted/50"
                  style={{ width: 40, minWidth: 40 }}
                >
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => (
                  <td 
                    key={colIndex}
                    className="border-r border-b border-border/30 p-0"
                    style={{ width: getColumnWidth(colIndex), minWidth: minColWidth }}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                      onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
                      className={`w-full px-3 py-2 text-sm bg-transparent outline-none font-mono transition-colors ${
                        focusedCell?.row === rowIndex && focusedCell?.col === colIndex 
                          ? 'bg-primary/10 ring-1 ring-primary/50' 
                          : 'hover:bg-muted/30'
                      }`}
                      placeholder=""
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      {hasData && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {cells.length} linhas × {cells[0]?.length || 0} colunas
          </span>
          <button
            onClick={() => {
              const text = cells.map(row => row.join('\t')).join('\n');
              onDataPaste(text);
            }}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Processar Dados
          </button>
        </div>
      )}
    </div>
  );
}
