import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, Wand2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { gerarMensagem, variarMensagem, MODELS } from '@/services/ai';

const MODEL_KEY = 'nexia_ai_model';

export function AiGenerateButton({ onApply }: { onApply: (texto: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [resultado, setResultado] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModelState] = useState<string>(() => {
    return localStorage.getItem(MODEL_KEY) ?? MODELS[0];
  });

  const setModel = (m: string) => {
    setModelState(m);
    localStorage.setItem(MODEL_KEY, m);
  };

  async function handleGerar() {
    if (!prompt.trim()) return toast.error('Descreva o que quer enviar');
    setBusy(true);
    try {
      const texto = await gerarMensagem(prompt, model);
      setResultado(texto);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" /> Gerar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar mensagem com IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Modelo (OpenRouter)</Label>
            <Input
              list="ia-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1"
            />
            <datalist id="ia-models">
              {MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <Label className="text-xs">O que você quer comunicar?</Label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex.: convidar para o lançamento do meu curso de marketing dia 20/06"
            />
          </div>
          <Button onClick={handleGerar} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar
          </Button>
          {resultado && (
            <div className="space-y-2 rounded-md border border-border bg-accent/30 p-3">
              <p className="whitespace-pre-wrap text-sm">{resultado}</p>
              <Button
                size="sm"
                onClick={() => {
                  onApply(resultado);
                  setOpen(false);
                  setResultado('');
                  setPrompt('');
                  toast.success('Mensagem aplicada');
                }}
              >
                <Check className="mr-2 h-4 w-4" /> Usar esta mensagem
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AiVaryButton({ texto, onApply }: { texto: string; onApply: (texto: string) => void }) {
  const [open, setOpen] = useState(false);
  const [versoes, setVersoes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [qtd, setQtd] = useState(3);
  const [model, setModelState] = useState<string>(() => {
    return localStorage.getItem(MODEL_KEY) ?? MODELS[0];
  });

  const setModel = (m: string) => {
    setModelState(m);
    localStorage.setItem(MODEL_KEY, m);
  };

  async function handleVariar() {
    if (!texto?.trim()) return toast.error('Escreva uma mensagem primeiro');
    setBusy(true);
    try {
      const versoes = await variarMensagem(texto, qtd, model);
      setVersoes(versoes);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setVersoes([]);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!texto?.trim()}>
          <Wand2 className="mr-2 h-4 w-4" /> Variar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reescrever mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Modelo (OpenRouter)</Label>
            <Input
              list="ia-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1"
            />
            <datalist id="ia-models">
              {MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantidade de versões</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={qtd}
                onChange={(e) => setQtd(Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={handleVariar} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Gerar variações
          </Button>
          {versoes.length > 0 && (
            <div className="space-y-2">
              {versoes.map((v, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border bg-accent/30 p-3">
                  <p className="whitespace-pre-wrap text-sm">{v}</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApply(v);
                      setOpen(false);
                      toast.success('Versão aplicada');
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" /> Usar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
