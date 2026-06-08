import React, { useState } from 'react';
import { Search, Loader2, Building2, MapPin, Phone as PhoneIcon, Star, Save, AlertCircle, Globe, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { searchBusinesses, Business } from '@/services/businessSearch';
import { getContactLists, createContactList, importContactsToLists } from '@/services/contactLists';

const RESULTS_OPTIONS = [10, 20, 30, 40, 50];

export function BusinessSearch() {
  const [keyword, setKeyword] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    if (!keyword.trim()) { toast.error('Digite uma palavra-chave'); return; }
    setLoading(true);
    setSearched(true);
    const businesses = await searchBusinesses(keyword.trim(), maxResults);
    setResults(businesses);
    setLoading(false);
    if (businesses.length === 0) {
      toast.warning('Nenhum resultado encontrado. Pode ser necessário configurar a chave da API Google.');
    } else {
      toast.success(`${businesses.length} empresas encontradas!`);
    }
  }

  async function handleSaveAsList() {
    const withPhone = results.filter(r => r.phone);
    if (withPhone.length === 0) { toast.error('Nenhum resultado com telefone para salvar'); return; }

    const listName = `${keyword.trim()} - ${new Date().toLocaleDateString()}`;
    const list = createContactList(listName, `Empresas encontradas para "${keyword}"`);
    if (!list) { toast.error('Erro ao criar lista'); return; }

    const rows = withPhone.map(r => ({
      name: r.razaoSocial || r.name,
      phone: r.phone.replace(/\D/g, ''),
      attributes: {
        endereco: r.address,
        avaliacao: r.rating.toString(),
        website: r.website,
        keyword: keyword.trim(),
        cnpj: r.cnpj || '',
        cnae: r.cnae || '',
        razao_social: r.razaoSocial || '',
      },
    }));

    const imported = importContactsToLists(list.id, rows);
    toast.success(`${imported} contatos salvos na lista "${listName}"`);
  }

  const withPhone = results.filter(r => r.phone);
  const withCnpj = results.filter(r => r.cnpj);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Buscar Empresas por Palavra-chave
        </h2>
        <p className="text-sm text-muted-foreground">
          Encontre empresas pelo ramo de atividade e crie listas de contato para campanhas
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Ex: lavanderia, pizzaria, barbearia..."
          className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
        />
        <select
          value={maxResults}
          onChange={e => setMaxResults(Number(e.target.value))}
          className="px-3 py-3 rounded-lg bg-muted/50 border border-border/50 text-sm"
        >
          {RESULTS_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-1">
        <p><strong>Fluxo:</strong> Google Places → nomes/telefones → se tiver site, extrai CNPJ → BrasilAPI enriquece</p>
        <p>Empresas sem site não terão CNPJ automaticamente. Use <strong>Listas de Contatos &gt; Consultar CNPJ</strong> para enriquecer manualmente.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm">Buscando empresas...</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">Nenhuma empresa encontrada para "{keyword}".</p>
          <p className="text-xs max-w-md text-center">
            Configure a chave Google Places API em <strong>Configurações &gt; Google Places</strong>
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length} empresas | {withPhone.length} com telefone | {withCnpj.length} com CNPJ
            </p>
            {withPhone.length > 0 && (
              <button
                onClick={handleSaveAsList}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Save className="h-4 w-4" />
                Salvar {withPhone.length} na Lista de Contatos
              </button>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-2 border border-border rounded-lg p-2">
            {results.map((biz, i) => (
              <div key={biz.placeId || i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{biz.name}</div>
                  {biz.razaoSocial && biz.razaoSocial !== biz.name && (
                    <div className="text-xs text-muted-foreground">{biz.razaoSocial}</div>
                  )}
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    {biz.address && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{biz.address}</p>}
                    {biz.phone && <p className="flex items-center gap-1"><PhoneIcon className="h-3 w-3" />{biz.phone}</p>}
                    {biz.rating > 0 && <p className="flex items-center gap-1"><Star className="h-3 w-3" />{biz.rating}</p>}
                    {biz.cnpj && (
                      <p className="flex items-center gap-1 text-success">
                        <FileText className="h-3 w-3" />
                        CNPJ: {biz.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                        {biz.cnae && <span className="text-muted-foreground ml-1">| {biz.cnae}</span>}
                      </p>
                    )}
                    {biz.website && (
                      <a href={biz.website} target="_blank" rel="noopener" className="flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" />{biz.website}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Globe className="h-10 w-10" />
          <p className="text-sm">Digite uma palavra-chave para encontrar empresas</p>
          <p className="text-xs">Ex: lavanderia, pizzaria, barbearia, mercado, farmácia...</p>
        </div>
      )}
    </div>
  );
}
