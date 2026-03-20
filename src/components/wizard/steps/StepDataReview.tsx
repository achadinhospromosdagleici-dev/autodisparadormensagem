import React, { useState, useMemo } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import { validatePhoneNumber } from '@/utils/phoneValidation';
import {
  Search,
  Filter,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Check,
  X,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';

type FilterType = 'all' | 'valid' | 'invalid';

const MAPPING_OPTIONS = [
  { value: 'numero', label: 'Número *', color: 'text-primary' },
  { value: 'nome', label: 'Nome Completo', color: 'text-blue-400' },
  { value: 'email', label: 'Email', color: 'text-purple-400' },
  { value: 'cpf', label: 'CPF', color: 'text-amber-400' },
  { value: 'empresa', label: 'Empresa', color: 'text-emerald-400' },
  { value: 'cidade', label: 'Cidade', color: 'text-cyan-400' },
  { value: 'custom', label: 'Campo Personalizado', color: 'text-foreground' },
  { value: '_skip', label: 'Não Carregar', color: 'text-muted-foreground' },
] as const;

export function StepDataReview() {
  const { data, columns, setColumns, setData, updateRow, deleteRow, deleteRows, settings, setSettings } = useWizard();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>(() => {
    // Initialize mapping from existing columns
    const mapping: Record<number, string> = {};
    columns.forEach((col, i) => {
      const found = MAPPING_OPTIONS.find(o => o.value === col);
      mapping[i] = found ? col : (col === 'numero' ? 'numero' : '_skip');
    });
    return mapping;
  });
  const [addDDI, setAddDDI] = useState(false);

  const originalColumns = columns;

  const handleMappingChange = (colIndex: number, value: string) => {
    setColumnMapping(prev => {
      const newMapping = { ...prev };
      // If selecting numero, remove it from other columns
      if (value === 'numero') {
        Object.keys(newMapping).forEach(key => {
          if (newMapping[Number(key)] === 'numero') {
            newMapping[Number(key)] = '_skip';
          }
        });
      }
      newMapping[colIndex] = value;
      return newMapping;
    });
  };

  const applyMapping = () => {
    const newColumns = originalColumns.map((col, i) => {
      const mapped = columnMapping[i] || '_skip';
      return mapped === '_skip' ? col : mapped;
    });
    setColumns(newColumns);

    // Re-validate phone numbers with DDI option
    if (addDDI) {
      const numCol = Object.entries(columnMapping).find(([, v]) => v === 'numero');
      if (numCol) {
        const updatedData = data.map(row => {
          let phone = row.numero as string;
          if (phone && !phone.startsWith('55') && !phone.startsWith('+55')) {
            phone = '55' + phone.replace(/\D/g, '');
          }
          const validation = validatePhoneNumber(phone);
          return { ...row, numero: validation.formatted, isValid: validation.isValid, errorMessage: validation.errorMessage };
        });
        setData(updatedData);
      }
    }

    toast.success('Mapeamento aplicado com sucesso');
  };

  const getMappingLabel = (colIndex: number) => {
    const value = columnMapping[colIndex] || '_skip';
    return MAPPING_OPTIONS.find(o => o.value === value) || MAPPING_OPTIONS[MAPPING_OPTIONS.length - 1];
  };

  const getMappingColor = (colIndex: number) => {
    const option = getMappingLabel(colIndex);
    return option.color;
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (filter === 'valid') result = result.filter((row) => row.isValid);
    else if (filter === 'invalid') result = result.filter((row) => !row.isValid);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col];
          return typeof value === 'string' && value.toLowerCase().includes(query);
        })
      );
    }
    return result;
  }, [data, filter, searchQuery, columns]);

  const validCount = data.filter((r) => r.isValid).length;
  const invalidCount = data.filter((r) => !r.isValid).length;

  const handleSelectAll = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map((row) => row.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedRows(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    deleteRows(Array.from(selectedRows));
    setSelectedRows(new Set());
    toast.success(`${selectedRows.size} registros removidos`);
  };

  const handleDeleteInvalid = () => {
    const invalidIds = data.filter((row) => !row.isValid).map((row) => row.id);
    deleteRows(invalidIds);
    toast.success(`${invalidIds.length} registros inválidos removidos`);
  };

  const handleClearData = () => {
    setData([]);
    setColumns(['numero']);
    setSelectedRows(new Set());
    toast.success('Dados limpos');
  };

  const startEditing = (row: typeof data[0]) => {
    setEditingRow(row.id);
    const values: Record<string, string> = {};
    columns.forEach((col) => { values[col] = (row[col] as string) || ''; });
    setEditValues(values);
  };

  const saveEditing = () => {
    if (!editingRow) return;
    const phoneValidation = validatePhoneNumber(editValues.numero || '');
    updateRow(editingRow, {
      ...editValues,
      numero: phoneValidation.formatted,
      isValid: phoneValidation.isValid,
      errorMessage: phoneValidation.errorMessage,
    });
    setEditingRow(null);
    setEditValues({});
    toast.success('Registro atualizado');
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditValues({});
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planilha de Importação</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={addDDI}
              onCheckedChange={(checked) => setAddDDI(checked === true)}
            />
            <span className="text-muted-foreground">Inserir DDI 55</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={settings.hasHeader}
              onCheckedChange={(checked) => setSettings({ hasHeader: checked === true })}
            />
            <span className="text-muted-foreground">1ª linha é cabeçalho</span>
          </label>
        </div>
      </div>

      {/* Stats + Actions Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold">{data.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Válidos</p>
              <p className="text-2xl font-bold text-success">{validCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Inválidos</p>
              <p className="text-2xl font-bold text-destructive">{invalidCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
              />
            </div>

            {/* Filter */}
            <div className="flex bg-muted/50 rounded-lg p-1">
              {(['all', 'valid', 'invalid'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'valid' ? 'Válidos' : 'Inválidos'}
                </button>
              ))}
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm hover:bg-muted transition-colors">
                Ações em Massa
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {selectedRows.size > 0 && (
                  <DropdownMenuItem onClick={handleDeleteSelected} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Selecionados ({selectedRows.size})
                  </DropdownMenuItem>
                )}
                {invalidCount > 0 && (
                  <DropdownMenuItem onClick={handleDeleteInvalid} className="text-destructive">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Remover Inválidos ({invalidCount})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={applyMapping}>
                  <Check className="w-4 h-4 mr-2" />
                  Aplicar Mapeamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={handleClearData}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Dados
            </button>
          </div>
        </div>
      </div>

      {/* Data Table with Column Mapping */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              {/* Mapping Row - Dropdowns */}
              <tr className="border-b border-border/50 bg-card/95 backdrop-blur-sm">
                <th className="py-2 px-4 w-10" />
                {columns.map((col, colIndex) => (
                  <th key={`mapping-${colIndex}`} className="py-2 px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs font-medium w-full justify-between hover:bg-muted transition-colors ${getMappingColor(colIndex)}`}>
                        <span className="truncate">{getMappingLabel(colIndex).label}</span>
                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {MAPPING_OPTIONS.map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() => handleMappingChange(colIndex, option.value)}
                            className={`text-xs ${option.color} ${columnMapping[colIndex] === option.value ? 'bg-primary/10' : ''}`}
                          >
                            {option.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                ))}
                <th className="py-2 px-4 w-16" />
              </tr>
              {/* Original Column Names Row */}
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left py-2 px-4">
                  <Checkbox
                    checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                {columns.map((col, colIndex) => (
                  <th
                    key={col}
                    className="text-left py-2 px-4 font-mono text-xs text-muted-foreground uppercase"
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      {col}
                    </span>
                  </th>
                ))}
                <th className="text-right py-2 px-4 text-xs text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/30 transition-colors ${
                    !row.isValid
                      ? 'bg-destructive/5 hover:bg-destructive/10'
                      : 'hover:bg-muted/30'
                  } ${selectedRows.has(row.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="py-3 px-4">
                    <Checkbox
                      checked={selectedRows.has(row.id)}
                      onCheckedChange={() => handleSelectRow(row.id)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="py-3 px-4">
                      {editingRow === row.id ? (
                        <input
                          type="text"
                          value={editValues[col] || ''}
                          onChange={(e) =>
                            setEditValues({ ...editValues, [col]: e.target.value })
                          }
                          className={`w-full px-2 py-1 rounded bg-muted border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                            col === 'numero' ? 'font-mono' : ''
                          }`}
                        />
                      ) : col === 'numero' ? (
                        <span className="font-mono text-primary">{row[col] as string}</span>
                      ) : (
                        <span className="text-foreground/80">{(row[col] as string) || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right">
                    {editingRow === row.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={saveEditing}
                          className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditing(row)}>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              deleteRow(row.id);
                              toast.success('Registro removido');
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Nenhum registro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
