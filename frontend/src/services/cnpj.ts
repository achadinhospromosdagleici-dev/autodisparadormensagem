export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  cnae_fiscal_descricao: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  porte: string;
}

export async function consultarCnpj(cnpj: string): Promise<CnpjData | null> {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Erro ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[CNPJ] Erro ao consultar:', err);
    return null;
  }
}

export function cnpjToAttributes(data: CnpjData): Record<string, string> {
  return {
    razao_social: data.razao_social || '',
    nome_fantasia: data.nome_fantasia || '',
    cnae: data.cnae_fiscal_descricao || '',
    endereco: [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(', '),
    cep: data.cep || '',
    email: data.email || '',
    telefone_comercial: data.telefone || '',
    porte: data.porte || '',
    situacao: data.descricao_situacao_cadastral || '',
  };
}
