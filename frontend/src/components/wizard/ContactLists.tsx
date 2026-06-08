import React, { useState, useEffect } from 'react';
import {
  List,
  Plus,
  Trash2,
  Edit3,
  Users,
  Phone,
  Download,
  Upload,
  X,
  Check,
  Loader2,
  Search,
  UserPlus,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getContactLists,
  createContactList,
  updateContactList,
  deleteContactList,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  importContactsToLists,
  ContactList,
  Contact,
} from '@/services/contactLists';
import { consultarCnpj, cnpjToAttributes, CnpjData } from '@/services/cnpj';

export function ContactLists() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingList, setEditingList] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAttrs, setContactAttrs] = useState('');
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cnpjQuery, setCnpjQuery] = useState('');
  const [cnpjResult, setCnpjResult] = useState<CnpjData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjExpanded, setCnpjExpanded] = useState(false);
  const [cnpjBusyContacts, setCnpjBusyContacts] = useState<Set<string>>(new Set());

  function loadLists() {
    setLists(getContactLists());
  }

  useEffect(() => { loadLists(); }, []);

  function loadContactsForList(listId: string) {
    setSelectedListId(listId);
    setContacts(getContacts(listId));
    setShowAddContact(false);
    setEditingContact(null);
  }

  function handleCreate() {
    if (!newName.trim()) { toast.error('Nome obrigatório'); return; }
    createContactList(newName.trim(), newDesc.trim());
    loadLists();
    setNewName(''); setNewDesc(''); setShowCreate(false);
    toast.success('Lista criada!');
  }

  function handleUpdate(listId: string) {
    if (!editName.trim()) { toast.error('Nome obrigatório'); return; }
    updateContactList(listId, { name: editName.trim(), description: editDesc.trim() });
    loadLists();
    setEditingList(null);
    toast.success('Lista atualizada!');
  }

  function handleDelete(listId: string) {
    if (!confirm('Excluir esta lista? Os contatos também serão removidos.')) return;
    deleteContactList(listId);
    if (selectedListId === listId) { setSelectedListId(null); setContacts([]); }
    loadLists();
    toast.success('Lista excluída!');
  }

  function handleAddContact() {
    if (!contactPhone.trim()) { toast.error('Telefone obrigatório'); return; }
    if (!selectedListId) return;
    const attrs: Record<string, string> = {};
    contactAttrs.split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k.trim()) attrs[k.trim()] = v.join('=').trim();
    });
    createContact(selectedListId, contactName.trim(), contactPhone.trim(), attrs);
    setContacts(getContacts(selectedListId));
    setContactName(''); setContactPhone(''); setContactAttrs('');
    toast.success('Contato adicionado!');
  }

  function handleUpdateContact(contactId: string) {
    if (!contactPhone.trim()) { toast.error('Telefone obrigatório'); return; }
    const attrs: Record<string, string> = {};
    contactAttrs.split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k.trim()) attrs[k.trim()] = v.join('=').trim();
    });
    updateContact(contactId, { name: contactName.trim(), phone: contactPhone.trim(), attributes: attrs });
    if (selectedListId) setContacts(getContacts(selectedListId));
    setEditingContact(null);
    setContactName(''); setContactPhone(''); setContactAttrs('');
    toast.success('Contato atualizado!');
  }

  function handleDeleteContact(contactId: string) {
    if (!confirm('Excluir este contato?')) return;
    deleteContact(contactId);
    if (selectedListId) setContacts(getContacts(selectedListId));
    toast.success('Contato excluído!');
  }

  async function handleCnpjLookup(cnpj: string) {
    setCnpjLoading(true);
    setCnpjResult(null);
    const data = await consultarCnpj(cnpj);
    if (!data) {
      toast.error('CNPJ não encontrado');
    } else {
      setCnpjResult(data);
      toast.success('Dados encontrados!');
    }
    setCnpjLoading(false);
  }

  async function handleBatchCnpjEnrich() {
    if (!selectedListId) return;
    const withCnpj = contacts.filter(c => c.attributes['cnpj']?.replace(/\D/g, '').length === 14);
    if (withCnpj.length === 0) { toast.error('Nenhum contato com CNPJ válido'); return; }
    const busy = new Set<string>();
    let success = 0;
    for (const c of withCnpj) {
      busy.add(c.id);
      setCnpjBusyContacts(new Set(busy));
      const data = await consultarCnpj(c.attributes['cnpj']);
      if (data) {
        const newAttrs = { ...c.attributes, ...cnpjToAttributes(data) };
        updateContact(c.id, { attributes: newAttrs });
        success++;
      }
    }
    setCnpjBusyContacts(new Set());
    if (selectedListId) setContacts(getContacts(selectedListId));
    toast.success(`${success} de ${withCnpj.length} contatos enriquecidos`);
  }

  async function handleCnpjForContact(contact: Contact) {
    const cnpj = contact.attributes['cnpj']?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) {
      toast.error('CNPJ inválido no contato');
      return;
    }
    setCnpjBusyContacts(prev => new Set(prev).add(contact.id));
    const data = await consultarCnpj(cnpj);
    if (data) {
      const newAttrs = { ...contact.attributes, ...cnpjToAttributes(data) };
      updateContact(contact.id, { attributes: newAttrs });
      if (selectedListId) setContacts(getContacts(selectedListId));
      toast.success('Dados do CNPJ adicionados aos atributos!');
    } else {
      toast.error('CNPJ não encontrado');
    }
    setCnpjBusyContacts(prev => { const s = new Set(prev); s.delete(contact.id); return s; });
  }

  function handleAddCnpjResultToList() {
    if (!selectedListId || !cnpjResult) return;
    createContact(selectedListId, cnpjResult.razao_social || cnpjResult.nome_fantasia, cnpjResult.telefone?.replace(/\D/g, '') || '', {
      ...cnpjToAttributes(cnpjResult),
      cnpj: cnpjResult.cnpj,
    });
    setContacts(getContacts(selectedListId));
    toast.success('Contato adicionado à lista!');
  }

  function handleCsvImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !selectedListId) return;
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV precisa de cabeçalho + dados'); return; }

      const headerLine = lines[0];
      const sep = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine.split(sep).map(h => h.trim().toLowerCase());

      const nomeIdx = headers.findIndex(h => /nome|name/.test(h));
      const phoneIdx = headers.findIndex(h => /telefone|phone|celular|whatsapp|fone/.test(h));
      if (phoneIdx === -1) { toast.error('Coluna de telefone não encontrada'); return; }

      const rows: { name?: string; phone: string; attributes?: Record<string, string> }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(sep);
        const phone = vals[phoneIdx]?.trim() || '';
        if (!phone) continue;
        const attrs: Record<string, string> = {};
        headers.forEach((h, idx) => {
          if (idx !== nomeIdx && idx !== phoneIdx && vals[idx]?.trim()) {
            attrs[h] = vals[idx].trim();
          }
        });
        rows.push({
          name: nomeIdx >= 0 ? vals[nomeIdx]?.trim() || '' : '',
          phone,
          attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        });
      }

      const imported = importContactsToLists(selectedListId, rows);
      setContacts(getContacts(selectedListId));
      toast.success(`${imported} contato(s) importados!`);
    };
    input.click();
  }

  function exportCsv() {
    if (contacts.length === 0) { toast.error('Nenhum contato para exportar'); return; }
    const headers = ['nome', 'telefone'];
    const attrKeys = new Set<string>();
    contacts.forEach(c => Object.keys(c.attributes).forEach(k => attrKeys.add(k)));
    attrKeys.forEach(k => headers.push(k));

    const lines = [headers.join(',')];
    contacts.forEach(c => {
      const vals = [c.name, c.phone];
      attrKeys.forEach(k => vals.push(c.attributes[k] || ''));
      lines.push(vals.join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contatos.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  }

  function startEditContact(c: Contact) {
    setEditingContact(c.id);
    setContactName(c.name);
    setContactPhone(c.phone);
    setContactAttrs(Object.entries(c.attributes).map(([k, v]) => `${k}=${v}`).join('\n'));
  }

  const filteredContacts = search
    ? contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : contacts;

  const selectedList = lists.find(l => l.id === selectedListId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <List className="h-5 w-5" />
            Listas de Contatos
          </h2>
          <p className="text-sm text-muted-foreground">Gerencie listas de contatos com atributos personalizados</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Lista
        </button>
      </div>

      {/* Create List */}
      {showCreate && (
        <div className="glass-card p-4 space-y-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da lista"
            className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição (opcional)"
            className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Criar</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-muted font-medium hover:bg-muted/80">Cancelar</button>
          </div>
        </div>
      )}

      {/* CNPJ Consultation */}
      <div className="glass-card p-4 space-y-3">
        <button onClick={() => setCnpjExpanded(!cnpjExpanded)} className="flex items-center justify-between w-full text-left">
          <span className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Consultar CNPJ
          </span>
          <span className="text-xs text-muted-foreground">{cnpjExpanded ? '▲' : '▼'}</span>
        </button>
        {cnpjExpanded && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={cnpjQuery} onChange={e => setCnpjQuery(e.target.value)} placeholder="Digite um CNPJ (apenas números)"
                className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
              <button onClick={() => handleCnpjLookup(cnpjQuery)} disabled={cnpjQuery.replace(/\D/g, '').length !== 14 || cnpjLoading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
                {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
            {cnpjResult && (
              <div className="text-xs space-y-1 p-3 bg-muted/30 rounded-lg">
                <p><strong>Razão Social:</strong> {cnpjResult.razao_social}</p>
                <p><strong>Fantasia:</strong> {cnpjResult.nome_fantasia}</p>
                <p><strong>Endereço:</strong> {[cnpjResult.logradouro, cnpjResult.numero, cnpjResult.bairro].filter(Boolean).join(', ')}</p>
                <p><strong>Cidade/UF:</strong> {cnpjResult.municipio}/{cnpjResult.uf}</p>
                <p><strong>Telefone:</strong> {cnpjResult.telefone}</p>
                <p><strong>Email:</strong> {cnpjResult.email}</p>
                <p><strong>CNAE:</strong> {cnpjResult.cnae_fiscal_descricao}</p>
                <p><strong>Situação:</strong> {cnpjResult.descricao_situacao_cadastral}</p>
                {selectedListId && (
                  <button onClick={handleAddCnpjResultToList}
                    className="mt-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                    Adicionar como contato na lista atual
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedListId ? (
        /* List Grid */
        lists.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <List className="h-10 w-10" />
            <p className="text-sm">Nenhuma lista criada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {lists.map(list => (
              <div key={list.id} className="glass-card p-4 space-y-3 hover:border-primary/30 cursor-pointer transition-all"
                onClick={() => loadContactsForList(list.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{list.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); setEditingList(list.id); setEditName(list.name); setEditDesc(list.description); }}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(list.id); }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {list.description && <p className="text-xs text-muted-foreground">{list.description}</p>}
                <p className="text-xs text-muted-foreground">{list.contactCount} contato(s)</p>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Single List View */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedListId(null)} className="text-sm text-primary hover:underline">&larr; Voltar</button>
            <span className="text-sm font-medium">{selectedList?.name}</span>
            <span className="text-xs text-muted-foreground">{contacts.length} contato(s)</span>
          </div>

          {editingList && (
            <div className="glass-card p-4 space-y-3">
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <div className="flex gap-2">
                <button onClick={() => selectedListId && handleUpdate(selectedListId)}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Salvar</button>
                <button onClick={() => setEditingList(null)} className="px-4 py-2 rounded-lg bg-muted font-medium hover:bg-muted/80">Cancelar</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowAddContact(true); setEditingContact(null); setContactName(''); setContactPhone(''); setContactAttrs(''); }}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent">
              <UserPlus className="h-4 w-4" /> Novo Contato
            </button>
            <button onClick={handleCsvImport}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> Importar CSV
            </button>
            <button onClick={exportCsv}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
            {contacts.some(c => c.attributes['cnpj']) && (
              <button onClick={handleBatchCnpjEnrich}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent ml-auto">
                <Building2 className="h-4 w-4" /> Enriquecer CNPJs
              </button>
            )}
          </div>

          {/* Add/Edit Contact Form */}
          {(showAddContact || editingContact) && (
            <div className="glass-card p-4 space-y-3">
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Telefone (com DDI/DDD)"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <textarea value={contactAttrs} onChange={e => setContactAttrs(e.target.value)} rows={3}
                placeholder="Atributos (opcional):&#10;cargo=Gerente&#10;idade=30"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              <div className="flex gap-2">
                {editingContact ? (
                  <button onClick={() => handleUpdateContact(editingContact)}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Salvar</button>
                ) : (
                  <button onClick={handleAddContact}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Adicionar</button>
                )}
                <button onClick={() => { setShowAddContact(false); setEditingContact(null); }}
                  className="px-4 py-2 rounded-lg bg-muted font-medium hover:bg-muted/80">Cancelar</button>
              </div>
            </div>
          )}

          {/* Search */}
          {contacts.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
                placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          )}

          {/* Contacts Table */}
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Nenhum contato nesta lista.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-muted-foreground">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-muted-foreground">Atributos</th>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredContacts.map(c => (
                    <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {Object.entries(c.attributes).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded bg-muted/50">
                            {k}={v}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.attributes['cnpj'] && (
                          <button onClick={() => handleCnpjForContact(c)} disabled={cnpjBusyContacts.has(c.id)}
                            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground inline-block"
                            title="Buscar dados do CNPJ">
                            {cnpjBusyContacts.has(c.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button onClick={() => startEditContact(c)}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground inline-block"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteContact(c.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-block"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
