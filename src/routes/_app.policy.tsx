import { useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPolicyState,
  uploadAndExtractPolicy,
  savePolicyRule,
  deletePolicyRule,
  type PolicyRuleDTO,
  type PolicyVersionDTO,
  type PolicyCategory,
} from "@/lib/policy.functions";
import { categoryLabels } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  Calendar,
  Fuel,
  UtensilsCrossed,
  BedDouble,
  Route as RouteIcon,
  ReceiptText,
  ListChecks,
  Loader2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: PolicyCategory[] = [
  "combustivel",
  "refeicao",
  "hospedagem",
  "transporte",
  "pedagio",
  "material",
  "documentos",
  "outros",
];

type RuleDraft = {
  id?: string;
  code: string;
  title: string;
  category: PolicyCategory;
  limit: string;
  basis: string;
  text: string;
};

const emptyDraft: RuleDraft = {
  code: "",
  title: "",
  category: "outros",
  limit: "",
  basis: "",
  text: "",
};


export const Route = createFileRoute("/_app/policy")({
  head: () => ({ meta: [{ title: "Política · reembolso.ia.br" }] }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/policy", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  component: PolicyPage,
});

const ruleIcons: Record<PolicyRuleDTO["category"], typeof Fuel> = {
  combustivel: Fuel,
  refeicao: UtensilsCrossed,
  hospedagem: BedDouble,
  transporte: RouteIcon,
  pedagio: ReceiptText,
  material: ReceiptText,
  outros: ReceiptText,
  documentos: ReceiptText,
};

function categoryLabel(category: PolicyRuleDTO["category"]) {
  return category === "documentos" ? "Documentos" : categoryLabels[category];
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PolicyPage() {
  const fetchState = useServerFn(getPolicyState);
  const uploadFn = useServerFn(uploadAndExtractPolicy);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["policy-state"],
    queryFn: () => fetchState(),
  });

  const versions: PolicyVersionDTO[] = data?.versions ?? [];
  const rules: PolicyRuleDTO[] = data?.rules ?? [];
  const active = versions.find((p) => p.active);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fileBase64 = await fileToBase64(file);
      return uploadFn({ data: { fileName: file.name, fileBase64 } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["policy-state"] });
      toast.success("Nova versão publicada", {
        description: `A IA leu o PDF e extraiu ${res.rulesCount} regra(s). A política passou a valer para as próximas análises.`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao publicar a política.";
      toast.error("Não foi possível publicar", { description: message });
    },
  });

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    mutation.mutate(file);
  };

  const openPicker = () => fileInputRef.current?.click();
  const busy = mutation.isPending;

  // ---- Edição manual de regras ----
  const saveRuleFn = useServerFn(savePolicyRule);
  const deleteRuleFn = useServerFn(deletePolicyRule);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<PolicyRuleDTO | null>(null);

  const openNewRule = () => {
    setDraft(emptyDraft);
    setEditorOpen(true);
  };

  const openEditRule = (r: PolicyRuleDTO) => {
    setDraft({
      id: r.id,
      code: r.code,
      title: r.title,
      category: r.category,
      limit: r.limit,
      basis: r.basis,
      text: r.text,
    });
    setEditorOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (d: RuleDraft) => saveRuleFn({ data: d }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-state"] });
      setEditorOpen(false);
      toast.success(draft.id ? "Regra atualizada" : "Regra adicionada");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao salvar a regra.";
      toast.error("Não foi possível salvar", { description: message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRuleFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-state"] });
      setDeleteTarget(null);
      toast.success("Regra removida");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao remover a regra.";
      toast.error("Não foi possível remover", { description: message });
    },
  });

  const submitRule = () => {
    if (!draft.code.trim() || !draft.title.trim()) {
      toast.error("Código e título são obrigatórios.");
      return;
    }
    saveMutation.mutate({
      ...draft,
      code: draft.code.trim(),
      title: draft.title.trim(),
    });
  };


  return (
    <div className="animate-fade-rise space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <PageHeader
        eyebrow="Governança"
        title="Política de reembolso"
        description="A política é o combustível da IA: cada recomendação cita a cláusula e a versão vigente que a justifica."
        actions={
          <Button onClick={openPicker} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {busy ? "Processando…" : "Publicar nova versão"}
          </Button>
        }
      />

      {/* Banner explicativo */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/8 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15">
          <Sparkles className="h-5 w-5 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            A IA lê o PDF da política e extrai as regras automaticamente.
          </p>
          <p className="text-sm text-muted-foreground">
            Ao publicar, o arquivo é guardado com segurança e a IA estrutura as cláusulas abaixo. Essas
            regras entram no contexto de cada análise de comprovante.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Política ativa */}
        <Card className="border-brand/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Política ativa</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : active ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
                    <FileText className="h-6 w-6 text-brand" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{active.version}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Em vigor
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5 border-t border-border pt-3 text-sm">
                  <Info icon={Calendar} label="Publicada em" value={formatDate(active.uploadedAt)} />
                  <Info icon={FileText} label="Arquivo" value={active.fileName} />
                  <Info icon={Clock} label="Publicada por" value={active.uploadedBy || "—"} />
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  {active.pages} páginas · {rules.length} regras estruturadas extraídas
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma política publicada ainda. Envie o PDF para a IA extrair as regras.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Enviar nova versão</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy) handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragging ? "border-brand bg-brand/5" : "border-border bg-secondary/30",
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                {busy ? (
                  <Loader2 className="h-7 w-7 animate-spin text-brand" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-brand" />
                )}
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                {busy ? "A IA está lendo a política…" : "Arraste o PDF da política ou clique para selecionar"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF até 10 MB · a nova versão é ativada automaticamente
              </p>
              <Button onClick={openPicker} disabled={busy} variant="outline" className="mt-5">
                {busy ? "Processando…" : "Selecionar arquivo"}
              </Button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>Ao publicar, a IA relê as cláusulas e passa a citá-las nas próximas análises de despesas.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview de regras estruturadas */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-brand" />
              Regras estruturadas extraídas da política
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Versão legível para humanos do que a IA enxerga ao avaliar um comprovante. Você pode editar
              ou inserir regras manualmente.
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={openNewRule}>
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {isError ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Não foi possível carregar as regras.
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-6 py-8 text-sm text-muted-foreground">
              <span>
                {isLoading
                  ? "Carregando regras…"
                  : "Nenhuma regra ainda. Publique um PDF para a IA extrair, ou adicione manualmente."}
              </span>
              {!isLoading && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={openNewRule}>
                  <Plus className="h-4 w-4" /> Adicionar regra manualmente
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-2.5 font-medium">Código</th>
                    <th className="px-4 py-2.5 font-medium">Título</th>
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-4 py-2.5 font-medium">Limite</th>
                    <th className="px-4 py-2.5 font-medium">Base do limite</th>
                    <th className="px-4 py-2.5 font-medium">Texto da regra</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((r, i) => {
                    const Icon = ruleIcons[r.category] ?? ReceiptText;
                    return (
                      <tr key={r.id ?? `${r.code}-${i}`} className="align-top transition-colors hover:bg-secondary/40">
                        <td className="px-6 py-3">
                          <span className="font-semibold tabular-nums text-brand">{r.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            {r.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {categoryLabel(r.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{r.limit || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.basis || "—"}</td>
                        <td className="max-w-md px-4 py-3 text-muted-foreground">{r.text}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditRule(r)}
                              aria-label="Editar regra"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(r)}
                              aria-label="Remover regra"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Histórico */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de versões</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {versions.length === 0 ? (
            <div className="px-6 py-8 text-sm text-muted-foreground">Nenhuma versão publicada ainda.</div>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {versions.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-3.5">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{p.version}</p>
                      {p.active ? (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                          Ativa
                        </span>
                      ) : p.status === "erro" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Erro
                        </span>
                      ) : p.status === "processando" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processando
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Arquivada
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.fileName} · {p.pages} págs · {p.sizeKb} KB
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    <p>{p.uploadedBy || "—"}</p>
                    <p className="tabular-nums">{formatDateTime(p.uploadedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor de regra (criar/editar) */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar regra" : "Nova regra"}</DialogTitle>
            <DialogDescription>
              Essas regras entram no contexto de cada análise de despesa pela IA.
            </DialogDescription>
          </DialogHeader>
          <form
            id="rule-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saveMutation.isPending) submitRule();
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rule-code">Código</Label>
                <Input
                  id="rule-code"
                  placeholder="4.1"
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-category">Categoria</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft((d) => ({ ...d, category: v as PolicyCategory }))}
                >
                  <SelectTrigger id="rule-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-title">Título</Label>
              <Input
                id="rule-title"
                placeholder="Limite por abastecimento"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rule-limit">Limite</Label>
                <Input
                  id="rule-limit"
                  placeholder="R$ 350,00"
                  value={draft.limit}
                  onChange={(e) => setDraft((d) => ({ ...d, limit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-basis">Base do limite</Label>
                <Input
                  id="rule-basis"
                  placeholder="por abastecimento"
                  value={draft.basis}
                  onChange={(e) => setDraft((d) => ({ ...d, basis: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-text">Texto da regra</Label>
              <Textarea
                id="rule-text"
                rows={4}
                placeholder="Descreva a cláusula como ela aparece na política."
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitRule} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {draft.id ? "Salvar alterações" : "Adicionar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra {deleteTarget?.code ? `“${deleteTarget.code}” ` : ""}será removida e deixará de ser
              usada nas análises. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
