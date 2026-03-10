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
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';

type FilterType = 'all' | 'valid' | 'invalid';

export function StepDataReview() {
  const { data, columns, updateRow, deleteRow, deleteRows } = useWizard();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const filteredData = useMemo(() => {
    let result = data;

    // Apply filter
    if (filter === 'valid') {
      result = result.filter((row) => row.isValid);
    } else if (filter === 'invalid') {
      result = result.filter((row) => !row.isValid);
    }

    // Apply search
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
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
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

  const startEditing = (row: typeof data[0]) => {
    setEditingRow(row.id);
    const values: Record<string, string> = {};
    columns.forEach((col) => {
      values[col] = (row[col] as string) || '';
    });
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
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-3xl font-bold">{data.length}</p>
          <p className="text-sm text-muted-foreground">Total de Registros</p>
        </div>
        <div className="glass-card p-4 text-center border-success/30">
          <p className="text-3xl font-bold text-success">{validCount}</p>
          <p className="text-sm text-muted-foreground">Válidos</p>
        </div>
        <div className="glass-card p-4 text-center border-destructive/30">
          <p className="text-3xl font-bold text-destructive">{invalidCount}</p>
          <p className="text-sm text-muted-foreground">Inválidos</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar registros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex bg-muted/50 rounded-lg p-1">
              {(['all', 'valid', 'invalid'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'valid' ? 'Válidos' : 'Inválidos'}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedRows.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedRows.size})
              </button>
            )}
            {invalidCount > 0 && (
              <button
                onClick={handleDeleteInvalid}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                Remover Inválidos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={
                      selectedRows.size === filteredData.length &&
                      filteredData.length > 0
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left py-3 px-4 font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">
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
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => handleSelectRow(row.id)}
                      className="w-4 h-4 rounded border-border accent-primary"
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
                        <span className="font-mono">{row[col] as string}</span>
                      ) : (
                        (row[col] as string) || '-'
                      )}
                    </td>
                  ))}
                  <td className="py-3 px-4">
                    {row.isValid ? (
                      <span className="flex items-center gap-1 text-success text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Válido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive text-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {row.errorMessage}
                      </span>
                    )}
                  </td>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEditing(row)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            deleteRow(row.id);
                            toast.success('Registro removido');
                          }}
                          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
