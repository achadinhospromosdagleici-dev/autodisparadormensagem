export interface ContactList {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  contactCount: number;
}

export interface Contact {
  id: string;
  listId: string;
  name: string;
  phone: string;
  attributes: Record<string, string>;
  createdAt: string;
}

const LISTS_KEY = 'contact_lists';
const CONTACTS_KEY = 'contact_contacts';

function loadLists(): ContactList[] {
  try {
    return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]');
  } catch { return []; }
}

function saveLists(lists: ContactList[]): void {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

function loadContacts(listId: string): Contact[] {
  try {
    const all: Contact[] = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
    return all.filter(c => c.listId === listId);
  } catch { return []; }
}

function saveAllContacts(contacts: Contact[]): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function getContactLists(): ContactList[] {
  return loadLists();
}

export function createContactList(name: string, description: string): ContactList {
  const lists = loadLists();
  const list: ContactList = {
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: new Date().toISOString(),
    contactCount: 0,
  };
  lists.push(list);
  saveLists(lists);
  return list;
}

export function updateContactList(id: string, updates: Partial<Pick<ContactList, 'name' | 'description'>>): void {
  const lists = loadLists();
  const idx = lists.findIndex(l => l.id === id);
  if (idx === -1) return;
  lists[idx] = { ...lists[idx], ...updates };
  saveLists(lists);
}

export function deleteContactList(id: string): void {
  const lists = loadLists();
  saveLists(lists.filter(l => l.id !== id));
  const all = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  saveAllContacts(all.filter((c: Contact) => c.listId !== id));
}

export function getContacts(listId: string): Contact[] {
  return loadContacts(listId);
}

export function createContact(listId: string, name: string, phone: string, attributes: Record<string, string>): Contact {
  const all: Contact[] = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  const contact: Contact = {
    id: crypto.randomUUID(),
    listId,
    name,
    phone: phone.replace(/\D/g, ''),
    attributes,
    createdAt: new Date().toISOString(),
  };
  all.push(contact);
  saveAllContacts(all);

  const lists = loadLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx !== -1) {
    lists[idx].contactCount = all.filter(c => c.listId === listId).length;
    saveLists(lists);
  }

  return contact;
}

export function updateContact(id: string, updates: Partial<Pick<Contact, 'name' | 'phone' | 'attributes'>>): void {
  const all: Contact[] = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return;
  if (updates.phone) updates.phone = updates.phone.replace(/\D/g, '');
  all[idx] = { ...all[idx], ...updates };
  saveAllContacts(all);
}

export function deleteContact(id: string): void {
  const all: Contact[] = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  const contact = all.find(c => c.id === id);
  saveAllContacts(all.filter(c => c.id !== id));
  if (contact) {
    const lists = loadLists();
    const idx = lists.findIndex(l => l.id === contact.listId);
    if (idx !== -1) {
      lists[idx].contactCount = all.filter(c => c.listId === contact.listId).length;
      saveLists(lists);
    }
  }
}

export function importContactsToLists(
  listId: string,
  rows: { name?: string; phone: string; attributes?: Record<string, string> }[],
): number {
  let imported = 0;
  const all: Contact[] = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  for (const row of rows) {
    const phone = row.phone.replace(/\D/g, '');
    if (phone.length < 8) continue;
    all.push({
      id: crypto.randomUUID(),
      listId,
      name: row.name || '',
      phone,
      attributes: row.attributes || {},
      createdAt: new Date().toISOString(),
    });
    imported++;
  }
  saveAllContacts(all);

  const lists = loadLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx !== -1) {
    lists[idx].contactCount = all.filter(c => c.listId === listId).length;
    saveLists(lists);
  }

  return imported;
}
