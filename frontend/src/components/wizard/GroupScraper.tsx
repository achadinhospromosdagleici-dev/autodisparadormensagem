import React, { useState } from 'react';
import { Search, ExternalLink, Loader2, AlertCircle, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { searchWhatsAppGroups, ScrapedGroup } from '@/services/groupScraper';

export function GroupScraper() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ScrapedGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!keyword.trim()) { toast.error('Digite uma palavra-chave'); return; }
    setLoading(true);
    setSearched(true);
    const groups = await searchWhatsAppGroups(keyword.trim());
    setResults(groups);
    setLoading(false);
    if (groups.length === 0) {
      if (!searched) {
        // Primeira busca sem resultado pode ser por deploy pendente
      }
      toast.info('Nenhum grupo encontrado. Veja as alternativas abaixo.');
    } else {
      toast.success(`${groups.length} grupo(s) encontrados!`);
    }
  }

  function openLink(link: string) {
    window.open(link, '_blank', 'noopener');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Buscar Grupos Públicos
        </h2>
        <p className="text-sm text-muted-foreground">
          Encontre links de grupos públicos do WhatsApp por palavra-chave
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Ex: lavanderia, comida, tecnologia..."
          className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm">Buscando grupos...</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">Nenhum grupo encontrado para "{keyword}".</p>
          <div className="text-xs space-y-2 max-w-md">
            <p>Isso pode acontecer se a função no servidor ainda não foi publicada.</p>
            <p className="font-medium text-foreground">Alternativa manual:</p>
            <p>Pesquise no Google e abra os links manualmente:</p>
            <a
              href={`https://www.google.com/search?q=site:chat.whatsapp.com+${encodeURIComponent(keyword)}`}
              target="_blank"
              rel="noopener"
              className="text-primary hover:underline block"
            >
              site:chat.whatsapp.com {keyword}
            </a>
            <p className="text-muted-foreground mt-2">Depois de entrar nos grupos, use <strong>Configurações &gt; Grupos</strong> para extrair os contatos.</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} grupo(s) encontrado(s)</p>
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {results.map((g, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{g.link}</div>
                </div>
                <button
                  onClick={() => openLink(g.link)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir
                </button>
              </div>
            ))}
          </div>

          <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como usar:</p>
            <p>1. Clique em <strong>Abrir</strong> para abrir o link do grupo</p>
            <p>2. Entre no grupo pelo WhatsApp</p>
            <p>3. Volte aqui e vá em <strong>Configurações &gt; Grupos</strong> para extrair os contatos</p>
            <p>4. Depois saia do grupo pelo WhatsApp</p>
          </div>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Globe className="h-10 w-10" />
          <p className="text-sm">Digite uma palavra-chave para encontrar grupos públicos</p>
        </div>
      )}
    </div>
  );
}
