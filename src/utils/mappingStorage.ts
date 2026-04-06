const STORAGE_KEY = 'column_mapping_history';

interface MappingEntry {
  columnName: string;
  mappedTo: string;
  count: number;
}

export function saveMappingHistory(mappings: Record<string, string>) {
  try {
    const existing = getMappingHistory();
    Object.entries(mappings).forEach(([colName, mappedTo]) => {
      if (mappedTo === '_skip') return;
      const normalized = colName.toLowerCase().trim();
      const entry = existing.find(e => e.columnName === normalized);
      if (entry) {
        entry.mappedTo = mappedTo;
        entry.count++;
      } else {
        existing.push({ columnName: normalized, mappedTo, count: 1 });
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {}
}

export function getMappingHistory(): MappingEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function autoMatchColumn(columnName: string): string | null {
  const normalized = columnName.toLowerCase().trim();

  // Check localStorage history first
  const history = getMappingHistory();
  const match = history.find(e => e.columnName === normalized);
  if (match) return match.mappedTo;

  // Built-in auto-match rules (ignoring accents/spaces)
  const rules: Record<string, RegExp> = {
    numero: /^(numero|telefone|phone|celular|whatsapp|fone|tel|mobile|cell|number)$/i,
    nome: /^(nome|name|nome_completo|full_name|primeiro_nome|first_name|contato|contact)$/i,
    email: /^(email|e-mail|e_mail|mail|correio)$/i,
    cpf: /^(cpf|cpf_cnpj|documento|document)$/i,
    empresa: /^(empresa|company|organizacao|organization|razao_social|firma)$/i,
    cidade: /^(cidade|city|municipio|localidade)$/i,
  };

  // Remove accents for matching
  const clean = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '_');

  for (const [field, regex] of Object.entries(rules)) {
    if (regex.test(clean) || regex.test(normalized)) {
      return field;
    }
  }

  return null;
}
