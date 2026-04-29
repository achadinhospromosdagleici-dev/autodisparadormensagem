$c = Get-Content 'src/components/wizard/steps/StepMessages.tsx'
$newLines = @'
  const [showFollowUp, setShowFollowUp] = useState(false);

  const variables = [...columns];
  if (columns.find((c) => c.toLowerCase() === 'nome')) {
    variables.push('{{primeiro_nome}}');
  }

  const insertVariable = (variable: string) => {
    setNewMessage((prev) => prev + variable);
  };

  const handleAddMessage = () => {
    if (mediaType === 'text' && !newMessage.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    if (['image', 'audio', 'video', 'document'].includes(mediaType) && !mediaUrl.trim()) {
      toast.error('Informe a URL da mídia');
      return;
    }
    if (mediaType === 'buttons') {
      if (!newMessage.trim()) { toast.error('Digite o texto da mensagem'); return; }
      if (buttons.length === 0) { toast.error('Adicione pelo menos um botão'); return; }
      const invalid = buttons.find(b => !b.label.trim() || (b.type !== 'reply' && !b.value.trim()));
      if (invalid) { toast.error('Preencha o texto e o valor de todos os botões'); return; }
    }
    if (mediaType === 'link') {
      if (!newMessage.trim()) { toast.error('Digite o texto da mensagem'); return; }
      if (!linkUrl.trim()) { toast.error('Informe a URL do link'); return; }
    }
    if (mediaType === 'contact') {
      if (!btnTitle.trim()) { toast.error('Digite o nome do contato'); return; }
      if (!btnFooter.trim()) { toast.error('Digite o número do contato'); return; }
    }
    if (mediaType === 'list') {
      if (!newMessage.trim()) { toast.error('Digite a descrição da lista'); return; }
      if (!btnTitle.trim()) { toast.error('Digite o título da lista'); return; }
      if (listSections.length === 0) { toast.error('Adicione pelo menos uma seção com itens'); return; }
      const invalidSection = listSections.find(s => !s.title.trim() || s.rows.length === 0);
      if (invalidSection) { toast.error('Cada seção precisa de título e pelo menos um item'); return; }
    }
    if (mediaType === 'carousel') {
      if (carouselCards.length === 0) { toast.error('Adicione pelo menos um card'); return; }
      const invalidCard = carouselCards.find(c => !c.title.trim());
      if (invalidCard) { toast.error('Cada card precisa de um título'); return; }
    }
    if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
      const invalid = buttons.find(b => !b.label.trim() || (b.type !== 'reply' && !b.value.trim()));
      if (invalid) { toast.error('Preencha o texto e o valor de todos os botões da mídia'); return; }
    }

    const isEditing = !!editingMessageId;
    const baseData = {
      content: newMessage.trim(),
      mediaType: mediaType as Message['mediaType'],
      mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
      mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
      mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
    };

    if (isEditing) {
      updateRichMessage(editingMessageId, baseData);
      toast.success('Mensagem atualizada');
    } else {
      if (mediaType === 'buttons') {
        addRichMessage({
          content: newMessage.trim(),
          mediaType: 'buttons',
          buttons: buttons.map(b => ({ ...b, label: b.label.trim(), value: b.value.trim() })),
          mediaCaption: btnTitle.trim() || undefined,
          mediaFilename: btnFooter.trim() || undefined,
        });
      } else if (mediaType === 'link') {
        addRichMessage({
          content: newMessage.trim(),
          mediaType: 'link',
          linkUrl: linkUrl.trim(),
        });
      } else if (mediaType === 'contact') {
        addRichMessage({
          content: newMessage.trim(),
          mediaType: 'contact',
          btnTitle: btnTitle.trim(),
          btnFooter: btnFooter.trim(),
        });
      } else if (mediaType === 'list' && isApiEvoGo) {
        addRichMessage({
          content: newMessage.trim(),
          mediaType: 'list',
          title: btnTitle.trim(),
          btnTitle: 'Selecionar',
          btnFooter: btnFooter.trim(),
          buttons: listSections as Message['buttons'],
        });
      } else if (mediaType === 'carousel' && isApiEvoGo) {
        addRichMessage({
          content: newMessage.trim(),
          mediaType: 'carousel',
          buttons: carouselCards as Message['buttons'],
        });
      } else if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
        addRichMessage({
          content: newMessage.trim(),
          mediaType,
          mediaUrl: mediaUrl.trim(),
          mediaCaption: newMessage.trim(),
          mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
          buttons: buttons.map(b => ({ ...b, label: b.label.trim(), value: b.value.trim() })),
        });
      } else {
        addMessage(newMessage.trim(), {
          mediaType,
          mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
          mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
          mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
        });
      }
      toast.success('Mensagem adicionada');
    }

    setNewMessage('');
    setMediaUrl('');
    setMediaFilename('');
    setBtnTitle('');
    setBtnFooter('');
    setButtons([]);
    setLinkUrl('');
    setListSections([]);
    setCarouselCards([]);
    setMediaType('text');
    setEditingMessageId(null);
  };

  const replaceVariables = (text: string, rowIndex: number) => {
    let result = text;
    const row = data[rowIndex];
    if (!row) return text;

    columns.forEach((col) => {
      const regex = new RegExp(`\\{\\{${col}\\}\\}`, 'gi');
      result = result.replace(regex, (row[col] as string) || `[${col}]`);
    });

    const nomeKey = columns.find((col) => col.toLowerCase() === 'nome');
    if (nomeKey) {
      const nomeValue = (row[nomeKey] as string) || '';
      const primeiroNome = nomeValue.trim().split(/\s+/)[0] || '[primeiro_nome]';
      result = result.replace(/\{\{primeiro_nome\}\}/gi, primeiroNome);
    }

    return result;
  };
'@
$c[56] = $newLines
$c | Set-Content 'src/components/wizard/steps/StepMessages.tsx'
