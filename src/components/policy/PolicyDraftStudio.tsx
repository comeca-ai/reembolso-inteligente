import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  draftPolicyFromInput,
  publishDraftPolicy,
  type PolicyRuleDTO,
  type PolicyVersionDTO,
} from "@/lib/policy.functions";
import { categoryLabels } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic,
  Square,
  Trash2,
  Loader2,
  Sparkles,
  Wand2,
  CheckCircle2,
  Pencil,
  FileAudio,
  Rocket,
  ClipboardList,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function categoryLabel(category: PolicyRuleDTO["category"]) {
  return category === "documentos" ? "Documentos" : categoryLabels[category];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

// Converte o áudio gravado (webm/opus) para WAV mono 16 kHz, formato aceito pela IA.
async function audioBlobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const targetRate = 16000;
    const source = decoded.getChannelData(0);
    const ratio = decoded.sampleRate / targetRate;
    const length = Math.floor(source.length / ratio);
    const resampled = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      resampled[i] = source[Math.floor(i * ratio)];
    }
    return arrayBufferToBase64(encodeWav(resampled, targetRate));
  } finally {
    void ctx.close();
  }
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const POLICY_TEMPLATE_TOPICS: { label: string; hint: string }[] = [
  { label: "Refeições", hint: "limite por dia/refeição, exige nota fiscal?" },
  { label: "Combustível", hint: "valor por km ou por abastecimento, exige cupom?" },
  { label: "Hospedagem", hint: "limite por diária, precisa de aprovação prévia?" },
  { label: "Transporte / apps", hint: "táxi, Uber, ônibus — quando é permitido?" },
  { label: "Pedágio e estacionamento", hint: "reembolsável? exige comprovante?" },
  { label: "Materiais e outros", hint: "o que entra, limites e exceções" },
  { label: "Documentos obrigatórios", hint: "nota fiscal, recibo, data, CNPJ…" },
  { label: "Prazos e aprovação", hint: "prazo para enviar e quem aprova" },
];

const POLICY_TEMPLATE_TEXT = `Política de reembolso — versão zero

${POLICY_TEMPLATE_TOPICS.map((t, i) => `${i + 1}. ${t.label}: (${t.hint})`).join("\n")}

Observações gerais: (regras que valem para todas as categorias)`;

interface Props {
  draft: PolicyVersionDTO | null;
  draftRules: PolicyRuleDTO[];
  onEditRule: (rule: PolicyRuleDTO) => void;
  onDeleteRule: (rule: PolicyRuleDTO) => void;
  onAddRule: (policyId: string) => void;
}

export function PolicyDraftStudio({
  draft,
  draftRules,
  onEditRule,
  onDeleteRule,
  onAddRule,
}: Props) {
  const queryClient = useQueryClient();
  const draftFn = useServerFn(draftPolicyFromInput);
  const publishFn = useServerFn(publishDraftPolicy);

  const [notes, setNotes] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        clearAudio();
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone", {
        description: "Verifique as permissões do navegador e tente novamente.",
      });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    stopTimer();
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload: { audioBase64?: string; audioMime?: string; notes?: string } = {
        notes: notes.trim() || undefined,
      };
      if (audioBlob) {
        payload.audioBase64 = await blobToBase64(audioBlob);
        payload.audioMime = audioBlob.type || "audio/webm";
      }
      return draftFn({ data: payload });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["policy-state"] });
      clearAudio();
      setNotes("");
      toast.success("Rascunho gerado", {
        description: `A IA estruturou ${res.rulesCount} regra(s). Revise e complemente antes de publicar.`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao gerar o rascunho.";
      toast.error("Não foi possível gerar", { description: message });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (policyId: string) => publishFn({ data: { policyId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-state"] });
      toast.success("Política publicada", {
        description: "A versão zero passou a valer para as próximas análises de despesas.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao publicar.";
      toast.error("Não foi possível publicar", { description: message });
    },
  });

  const canGenerate = (!!audioBlob || notes.trim().length > 0) && !generateMutation.isPending;

  return (
    <Card className="border-brand/20 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-brand" />
          Sem o PDF? Crie a política versão zero por áudio ou texto
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Grave os pontos mais importantes da política e/ou cole anotações. A IA transcreve, organiza em
          regras estruturadas e deixa tudo em rascunho para você revisar e complementar antes de publicar.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Gravação de áudio */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileAudio className="h-4 w-4 text-brand" /> Gravar áudio
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-3 py-3">
              {recording ? (
                <>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-105"
                    aria-label="Parar gravação"
                  >
                    <Square className="h-6 w-6 fill-current" />
                  </button>
                  <span className="inline-flex items-center gap-2 text-sm font-medium tabular-nums text-destructive">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                    {formatSeconds(seconds)} · gravando…
                  </span>
                </>
              ) : audioBlob ? (
                <div className="w-full space-y-3">
                  <audio controls src={audioUrl ?? undefined} className="w-full" />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Áudio pronto ({formatSeconds(seconds)})
                    </span>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={clearAudio}>
                      <Trash2 className="h-4 w-4" /> Descartar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105"
                    aria-label="Iniciar gravação"
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                  <span className="text-xs text-muted-foreground">Toque para gravar</span>
                </>
              )}
            </div>
          </div>

          {/* Texto colado */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-brand" /> Colar / digitar anotações
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-brand hover:text-brand"
                onClick={() =>
                  setNotes((prev) =>
                    prev.trim() ? `${prev.trimEnd()}\n\n${POLICY_TEMPLATE_TEXT}` : POLICY_TEMPLATE_TEXT,
                  )
                }
              >
                <ListChecks className="h-3.5 w-3.5" /> Usar template
              </Button>
            </div>
            <Textarea
              rows={6}
              className="mt-3 resize-none bg-background"
              placeholder="Ex.: Refeições até R$ 80 por dia. Combustível com nota fiscal. Hospedagem só com aprovação prévia…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Template de tópicos principais */}
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ListChecks className="h-4 w-4 text-brand" /> Principais tópicos para cobrir
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Não sabe por onde começar? Comente cada um destes pontos no áudio ou texto — quanto mais
            completo, melhor a IA estrutura as regras.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {POLICY_TEMPLATE_TOPICS.map((t) => (
              <div
                key={t.label}
                className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            Você pode usar só áudio, só texto, ou os dois juntos.
          </p>
          <Button onClick={() => generateMutation.mutate()} disabled={!canGenerate} className="gap-2">
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {generateMutation.isPending ? "Gerando rascunho…" : "Gerar rascunho com IA"}
          </Button>
        </div>

        {/* Rascunho gerado */}
        {draft && (
          <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                    Rascunho {draft.version}
                  </span>
                  {draftRules.length} regra(s) — revise antes de publicar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gerada por {draft.source === "text" ? "texto" : draft.source === "audio" ? "áudio" : "áudio + texto"}.
                  Edite, adicione regras e publique quando estiver pronta.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAddRule(draft.id)}>
                  <Pencil className="h-4 w-4" /> Adicionar regra
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => publishMutation.mutate(draft.id)}
                  disabled={publishMutation.isPending || draftRules.length === 0}
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Publicar versão zero
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border bg-background">
              {draftRules.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Nenhuma regra no rascunho. Adicione manualmente para poder publicar.
                </p>
              ) : (
                draftRules.map((r, i) => (
                  <div
                    key={r.id ?? `${r.code}-${i}`}
                    className={cn("flex items-start gap-3 px-4 py-3")}
                  >
                    <span className="mt-0.5 font-semibold tabular-nums text-brand">{r.code}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.title}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {categoryLabel(r.category)}
                        </span>
                        {r.limit && (
                          <span className="text-xs font-semibold tabular-nums text-foreground">{r.limit}</span>
                        )}
                      </div>
                      {r.text && <p className="mt-0.5 text-xs text-muted-foreground">{r.text}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onEditRule(r)}
                        aria-label="Editar regra"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteRule(r)}
                        aria-label="Remover regra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
