import React, { useState, useCallback, useEffect } from 'react';
import { useWizard, DataRow } from '@/contexts/WizardContext';
import { validatePhoneNumber, parseCSVLine, detectDelimiter, columnLooksLikePhone } from '@/utils/phoneValidation';
import { readFileAsText } from '@/utils/fileReader';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Table, ListOrdered, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SpreadsheetPasteArea } from '../SpreadsheetPasteArea';

export function StepDataEntry() {
  const { setData, setColumns, data, columns, settings, setSettings, nextStep } = useWizard();
  const [pasteData, setPasteData] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);

  // NÃO auto-ocultar - área só fecha quando usuário clica em Processar ou Fechar

  const processData = useCallback((text: string, hasHeader: boolean = true, isFromSpreadsheet = false) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error('Nenhum dado encontrado');
      return;
    }

    const delimiter = detectDelimiter(text);
    // Se vier da planilha manual, sempre substituir (não append)
    // Se vier de paste externo ou upload, manter comportamento de append
    const isAppending = !isFromSpreadsheet && data.length > 0;
    
    let cols = columns;
    let dataLines = lines;

    const headerLine = parseCSVLine(lines[0], delimiter);
    const firstLineNormalized = headerLine.map(c => c.toLowerCase().replace(/\s+/g, '_'));
    
    if (!isAppending) {
      const shouldHaveHeader = hasHeader && lines.length > 1;
      
      let initialCols = shouldHaveHeader
        ? headerLine
        : headerLine.map((_, i) => i === 0 ? 'numero' : `coluna_${i + 1}`);

      const dataSampleLines = shouldHaveHeader ? lines.slice(1, Math.min(6, lines.length)) : lines.slice(0, Math.min(5, lines.length));

      // Helper: get sample values for a column index
      const getSampleValues = (idx: number) =>
        dataSampleLines.map(line => {
          const values = parseCSVLine(line, delimiter);
          return values[idx] || '';
        });

      // First pass: prefer columns with phone-related names
      const phoneKeywords = /telefone|celular|fone|phone|cel|tel|numero|contato|whatsapp|mobile/i;
      let phoneColIndex = -1;

      if (shouldHaveHeader) {
        phoneColIndex = initialCols.findIndex((col, idx) =>
          phoneKeywords.test(col) && columnLooksLikePhone(getSampleValues(idx))
        );
      }

      // Second pass: fall back to value-only detection
      if (phoneColIndex < 0) {
        phoneColIndex = initialCols.findIndex((_, idx) =>
          columnLooksLikePhone(getSampleValues(idx))
        );
      }

      if (phoneColIndex >= 0 && initialCols[phoneColIndex] !== 'numero') {
        const phoneColName = initialCols[phoneColIndex];
        initialCols = initialCols.map((col, idx) => idx === phoneColIndex ? 'numero' : col);
        toast.success(`Coluna "${phoneColName}" detectada como telefone`);
      }

      cols = initialCols;
      setColumns(cols);
      dataLines = shouldHaveHeader ? lines.slice(1) : lines;
    } else {
      // If appending, check if user says there is a header or if it matches existing columns
      const matchesExisting = firstLineNormalized.some(c => columns.includes(c));
      const shouldSkipFirst = hasHeader || matchesExisting;
      dataLines = shouldSkipFirst ? lines.slice(1) : lines;
    }
    
    if (dataLines.length === 0) {
      toast.error('Nenhum registro de dados novo encontrado.');
      return;
    }
    
    const rows: DataRow[] = dataLines
      .filter(line => {
        const values = parseCSVLine(line, delimiter);
        return values.some(v => v.trim() !== '');
      })
      .map((line) => {
        const values = parseCSVLine(line, delimiter);
        const row: DataRow = {
          id: crypto.randomUUID(),
          numero: '',
          isValid: false,
        };

        cols.forEach((col, i) => {
          row[col] = values[i] || '';
        });

        const phoneValue = row.numero as string;
        const validation = validatePhoneNumber(phoneValue, true);
        row.isValid = validation.isValid;
        row.numero = validation.formatted;
        row.errorMessage = validation.errorMessage;

        return row;
      });

    setData(prev => isAppending ? [...prev, ...rows] : rows);
    const validCount = rows.filter(r => r.isValid).length;
    toast.success(`${rows.length} registros ${isAppending ? 'adicionados' : 'importados'} (${validCount} válidos)`);
  }, [setData, setColumns, data.length, columns]);

  const processSpreadsheetData = useCallback((text: string) => {
    processData(text, settings.hasHeader, true);
  }, [processData, settings.hasHeader]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setPasteData(text);
      processData(text, settings.hasHeader);
    }
  }, [processData, settings.hasHeader]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      if (text) {
        setPasteData(text);
        // File upload sempre substitui os dados (não faz append)
        processData(text, settings.hasHeader, true);
      }
    } catch {
      toast.error('Erro ao ler arquivo. Verifique se o formato é suportado.');
    }
    e.target.value = '';
  }, [processData, settings.hasHeader]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      try {
        const text = await readFileAsText(file);
        if (text) {
          setPasteData(text);
          // Drag & drop sempre substitui os dados
          processData(text, settings.hasHeader, true);
        }
      } catch {
        toast.error('Erro ao ler arquivo. Verifique se o formato é suportado.');
      }
    }
  }, [processData, settings.hasHeader]);

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Toggle between paste areas */}
      {!showPasteArea && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Textarea paste area */}
          <div 
            className={`relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => setShowPasteArea(true)}
          >
            <div className="text-center space-y-2">
              <Table className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Planilha</div>
              <p className="text-xs text-muted-foreground">Cole ou arraste dados no formato de planilha</p>
            </div>
          </div>

          {/* File upload */}
          <label className="relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer hover:border-primary/50 block">
            <input 
              type="file" 
              accept=".csv,.txt,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="text-center space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Upload</div>
              <p className="text-xs text-muted-foreground">Envie um arquivo CSV ou TXT</p>
            </div>
          </label>
        </div>
      )}

      {/* Show paste area when toggled */}
      {showPasteArea && (
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm">Cole dados da planilha (Ctrl+V)</span>
            </div>
            <button
              onClick={() => setShowPasteArea(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ✕ Fechar
            </button>
          </div>
          
          <SpreadsheetPasteArea 
            onDataPaste={(text) => {
              setPasteData(text);
              processSpreadsheetData(text);
            }}
          />

          {data.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dados carregados e processados automaticamente!</span>
            </div>
          )}
        </div>
      )}

      {/* Instructions - Collapsible */}
      {data.length === 0 && !showPasteArea && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Como importar dados:
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Escolha uma das opções acima (Planilha ou Upload)</li>
            <li>Cole ou arraste dados no formato: <strong>telefone, nome, empresa...</strong></li>
            <li>A primeira linha será usada como cabeçalho</li>
            <li>O sistema detectará automaticamente números de telefone</li>
          </ul>
        </div>
      )}

      {/* Show current data summary when we have data */}
      {(data.length > 0 && !showPasteArea) && (
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{data.length} contatos</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {columns.length} colunas
            </div>
          </div>
          <button
            onClick={() => setShowPasteArea(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <Plus className="w-4 h-4" />
            Adicionar mais
          </button>
        </div>
      )}

      {/* Format options */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.hasHeader}
            onChange={(e) => setSettings({ hasHeader: e.target.checked })}
            className="rounded border-border"
          />
          Primeira linha é cabeçalho
        </label>
      </div>
    </div>
  );
}