import React, { useState, useCallback } from 'react';
import { useWizard, DataRow } from '@/contexts/WizardContext';
import { validatePhoneNumber, parseCSVLine, detectDelimiter } from '@/utils/phoneValidation';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Table, FileText, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { SpreadsheetPasteArea } from '../SpreadsheetPasteArea';

export function StepDataEntry() {
  const { setData, setColumns, data, columns, settings, setSettings } = useWizard();
  const [pasteData, setPasteData] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const processData = useCallback((text: string, hasHeader: boolean = true) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error('Nenhum dado encontrado');
      return;
    }

    const delimiter = detectDelimiter(text);
    const headerLine = parseCSVLine(lines[0], delimiter);
    
    // Se só há uma linha, trata como dados sem cabeçalho
    const shouldHaveHeader = hasHeader && lines.length > 1;
    
    // Normalize column names
    const cols = shouldHaveHeader
      ? headerLine.map(col => col.toLowerCase().replace(/\s+/g, '_'))
      : headerLine.map((_, i) => i === 0 ? 'numero' : `coluna_${i + 1}`);

    // Ensure 'numero' column exists
    if (!cols.includes('numero')) {
      // Try to find a column that looks like phone numbers
      const phoneColIndex = headerLine.findIndex(col => 
        /phone|telefone|numero|number|celular|whatsapp/i.test(col)
      );
      
      if (phoneColIndex >= 0) {
        cols[phoneColIndex] = 'numero';
      } else {
        cols[0] = 'numero';
      }
    }

    setColumns(cols);

    const dataLines = shouldHaveHeader ? lines.slice(1) : lines;
    
    if (dataLines.length === 0) {
      toast.error('Nenhum registro de dados encontrado. Adicione linhas de dados abaixo do cabeçalho.');
      return;
    }
    
    const rows: DataRow[] = dataLines
      .filter(line => {
        // Skip empty lines or lines where all cells are empty
        const values = parseCSVLine(line, delimiter);
        return values.some(v => v.trim() !== '');
      })
      .map((line, index) => {
        const values = parseCSVLine(line, delimiter);
        const row: DataRow = {
          id: crypto.randomUUID(),
          numero: '',
          isValid: false,
        };

        cols.forEach((col, i) => {
          row[col] = values[i] || '';
        });

        // Validate phone number
        const phoneValue = row.numero as string;
        const validation = validatePhoneNumber(phoneValue);
        row.isValid = validation.isValid;
        row.numero = validation.formatted;
        row.errorMessage = validation.errorMessage;

        return row;
      });

    setData(rows);
    const validCount = rows.filter(r => r.isValid).length;
    toast.success(`${rows.length} registros importados (${validCount} válidos)`);
  }, [setData, setColumns]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setPasteData(text);
      processData(text);
    }
  }, [processData]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteData(text);
        processData(text, settings.hasHeader);
      }
    };
    reader.readAsText(file);
  }, [processData, settings.hasHeader]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setPasteData(text);
          processData(text, settings.hasHeader);
        }
      };
      reader.readAsText(file);
    }
  }, [processData, settings.hasHeader]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPasteData(e.target.value);
  };

  const handleProcessClick = () => {
    if (pasteData.trim()) {
      processData(pasteData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Upload Area */}
      <div
        className={`glass-card p-8 transition-all duration-300 ${
          isDragging ? 'border-primary bg-primary/5' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-6">
          {/* File Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Arraste um arquivo aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 inline-block mr-2" />
              Selecionar Arquivo
            </label>
          </div>

          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Header Option Toggle */}
          <div className="w-full glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {settings.hasHeader ? <FileText className="w-5 h-5 text-primary" /> : <ListOrdered className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <p className="font-medium">Primeira linha é cabeçalho?</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.hasHeader 
                      ? 'Ex: numero, nome, empresa (usará como nomes das colunas)' 
                      : 'Dados começam na primeira linha (colunas serão nomeadas automaticamente)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSettings({ hasHeader: true });
                    if (pasteData) processData(pasteData, true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.hasHeader 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Sim
                </button>
                <button
                  onClick={() => {
                    setSettings({ hasHeader: false });
                    if (pasteData) processData(pasteData, false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !settings.hasHeader 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          </div>

          {/* Spreadsheet-style Paste Area */}
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                Cole diretamente da planilha (Ctrl+V)
              </span>
            </div>
            
            <SpreadsheetPasteArea 
              onDataPaste={(text) => {
                setPasteData(text);
                processData(text, settings.hasHeader);
              }}
            />

            {data.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dados carregados! Clique em <strong>Avançar</strong> para continuar.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats - Simple summary after data is loaded */}
      {data.length > 0 && (
        <div className="glass-card p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{data.filter(r => r.isValid).length} válidos</span>
              </div>
              {data.filter(r => !r.isValid).length > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{data.filter(r => !r.isValid).length} com erro</span>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {data.length} contatos • {columns.length} colunas
            </div>
          </div>
        </div>
      )}

      {/* Instructions - Collapsible */}
      {data.length === 0 && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <span className="font-medium text-foreground">Dica: </span>
              A coluna <code className="variable-tag">numero</code> é obrigatória. 
              Colunas como <code className="variable-tag">nome</code> podem ser usadas como variáveis nas mensagens.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
