import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { inviteApprover } from "@/lib/invites.functions";
import { toast } from "sonner";
import {
  api,
  fieldUserStatusLabels,
  type FieldUser,
  type FieldUserStatus,
  type Approver,
} from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  ShieldCheck,
  Search,
  Smartphone,
  Mail,
  Info,
  Clock,
} from "lucide-react";

const fieldUsersQuery = queryOptions({ queryKey: ["field-users"], queryFn: () => api.listFieldUsers() });
const approversQuery = queryOptions({ queryKey: ["approvers"], queryFn: () => api.listApprovers() });

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Cadastros · reembolso.ia.br" }] }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/users", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(fieldUsersQuery),
      context.queryClient.ensureQueryData(approversQuery),
    ]);
  },
  component: UsersPage,
});

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const fieldStatusStyles: Record<FieldUserStatus, { dot: string; chip: string }> = {
  ativo: { dot: "bg-success", chip: "bg-success/15 text-success" },
  pendente: { dot: "bg-warning", chip: "bg-warning/15 text-warning" },
  bloqueado: { dot: "bg-destructive", chip: "bg-destructive/15 text-destructive" },
};

function FieldStatusBadge({ status }: { status: FieldUserStatus }) {
  const s = fieldStatusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {fieldUserStatusLabels[status]}
    </span>
  );
}

function UsersPage() {
  const { data: fieldUsers } = useSuspenseQuery(fieldUsersQuery);
  const { data: approvers } = useSuspenseQuery(approversQuery);
  const [tab, setTab] = useState<"campo" | "aprovador">("campo");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FieldUserStatus | "todos">("todos");
  const [drawer, setDrawer] = useState<null | "campo" | "aprovador">(null);

  const filteredField = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fieldUsers.filter((u) => {
      const matchesStatus = statusFilter === "todos" || u.status === statusFilter;
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.whatsapp ?? "").toLowerCase().includes(q) ||
        u.cpfMasked.toLowerCase().includes(q) ||
        u.team.toLowerCase().includes(q) ||
        u.approverName.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [fieldUsers, search, statusFilter]);

  const filteredApprovers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvers.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.jobTitle.toLowerCase().includes(q) ||
        (a.whatsapp ?? "").toLowerCase().includes(q),
    );
  }, [approvers, search]);

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Equipe"
        title="Cadastros"
        description="Cadastre quem envia comprovantes em campo e quem aprova na plataforma — o roteamento é feito pelo WhatsApp ou e-mail do remetente."
        actions={
          tab === "campo" ? (
            <Button onClick={() => setDrawer("campo")} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo usuário de campo
            </Button>
          ) : (
            <Button onClick={() => setDrawer("aprovador")} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Novo aprovador
            </Button>
          )
        }
      />


      {/* Microcopy — roteamento por telefone/e-mail */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">No MVP, o roteamento é feito pelo telefone ou e-mail do remetente.</span>{" "}
          Usuários de campo não fazem login: ao enviar um comprovante por WhatsApp ou e-mail cadastrado, a despesa é
          atribuída automaticamente ao colaborador e encaminhada ao seu aprovador.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "campo" | "aprovador");
          setSearch("");
          setStatusFilter("todos");
        }}
      >
        <TabsList>
          <TabsTrigger value="campo">
            Usuários de campo
            <span className="ml-1.5 tabular-nums text-muted-foreground">{fieldUsers.length}</span>
          </TabsTrigger>
          <TabsTrigger value="aprovador">
            Aprovadores
            <span className="ml-1.5 tabular-nums text-muted-foreground">{approvers.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Busca e filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "campo"
                ? "Buscar por nome, CPF, WhatsApp, e-mail ou aprovador…"
                : "Buscar por nome, e-mail ou função…"
            }
            className="pl-9"
          />
        </div>
        {tab === "campo" && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FieldUserStatus | "todos")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {tab === "campo" ? (
        <FieldUsersTable rows={filteredField} />
      ) : (
        <ApproversTable rows={filteredApprovers} />
      )}

      <FieldUserDrawer
        open={drawer === "campo"}
        onOpenChange={(o) => setDrawer(o ? "campo" : null)}
        approvers={approvers}
      />
      <ApproverDrawer open={drawer === "aprovador"} onOpenChange={(o) => setDrawer(o ? "aprovador" : null)} />
    </div>
  );
}

function FieldUsersTable({ rows }: { rows: FieldUser[] }) {
  return (
    <Card className="shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Colaborador</th>
              <th className="px-4 py-2.5 font-medium">CPF</th>
              <th className="px-4 py-2.5 font-medium">Contato</th>
              <th className="px-4 py-2.5 font-medium">Aprovador</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Ativação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.team} · {u.costCenter}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">{u.cpfMasked}</td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {u.whatsapp && (
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="h-3 w-3" /> {u.whatsapp}
                      </span>
                    )}
                    {u.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {u.email}
                      </span>
                    )}
                    {!u.whatsapp && !u.email && <span>—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.approverName}</td>
                <td className="px-4 py-3">
                  <FieldStatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {u.activatedAt ? u.activatedAt.split("-").reverse().join("/") : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum usuário de campo encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ApproversTable({ rows }: { rows: Approver[] }) {
  return (
    <Card className="shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Aprovador</th>
              <th className="px-4 py-2.5 font-medium">Função</th>
              <th className="px-4 py-2.5 font-medium">WhatsApp</th>
              <th className="px-4 py-2.5 font-medium">Acesso</th>
              <th className="px-4 py-2.5 text-right font-medium">Despesas pendentes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                        {initials(a.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.jobTitle}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{a.whatsapp ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                    <ShieldCheck className="h-3 w-3" /> Login web
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {a.pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium tabular-nums text-warning">
                      <Clock className="h-3 w-3" /> {a.pendingCount}
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum aprovador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FieldUserDrawer({
  open,
  onOpenChange,
  approvers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  approvers: Approver[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    cpfMasked: "",
    whatsapp: "",
    email: "",
    approverName: "",
    team: "",
    costCenter: "",
  });

  const reset = () =>
    setForm({ name: "", cpfMasked: "", whatsapp: "", email: "", approverName: "", team: "", costCenter: "" });

  const mutation = useMutation({
    mutationFn: () => api.createFieldUser(form),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["field-users"] });
      toast.success("Usuário de campo cadastrado", {
        description: `${u.name} foi adicionado como pendente. Roteamento por ${u.whatsapp ?? u.email}.`,
      });
      reset();
      onOpenChange(false);
    },
  });

  const canSubmit =
    form.name.trim() && form.approverName && (form.whatsapp.trim() || form.email.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo usuário de campo</SheetTitle>
          <SheetDescription>
            Sem login: identificado pelo WhatsApp ou e-mail informado. Informe ao menos um dos dois para o roteamento
            automático.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <Field label="Nome completo" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João da Silva" />
          </Field>
          <Field label="CPF (mascarado)">
            <Input value={form.cpfMasked} onChange={(e) => setForm({ ...form, cpfMasked: e.target.value })} placeholder="***.123.456-**" className="font-mono" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 90000-0000" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="colaborador@empresa.com.br" />
          </Field>
          <Field label="Aprovador responsável" required>
            <Select value={form.approverName} onValueChange={(v) => setForm({ ...form, approverName: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aprovador" />
              </SelectTrigger>
              <SelectContent>
                {approvers.map((a) => (
                  <SelectItem key={a.id} value={a.name}>
                    {a.name} — {a.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Equipe">
              <Input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="Técnica Campo SP" />
            </Field>
            <Field label="Centro de custo">
              <Input value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} placeholder="FLD-SP" />
            </Field>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Cadastrando…" : "Cadastrar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ApproverDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteApprover);
  const [form, setForm] = useState({ name: "", email: "", jobTitle: "", whatsapp: "" });
  const reset = () => setForm({ name: "", email: "", jobTitle: "", whatsapp: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      // Cadastro local (lista) + convite real por e-mail via Resend.
      const created = await api.createApprover(form);
      await invite({
        data: {
          email: form.email.trim(),
          nome: form.name.trim(),
          jobTitle: form.jobTitle.trim() || undefined,
          whatsapp: form.whatsapp.trim() || undefined,
          origin: window.location.origin,
        },
      });
      return created;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["approvers"] });
      toast.success("Convite enviado", {
        description: `${a.name} recebeu um e-mail com o link de acesso à plataforma.`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Não foi possível enviar o convite", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    },
  });

  const canSubmit = form.name.trim() && form.email.trim() && form.jobTitle.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo aprovador</SheetTitle>
          <SheetDescription>
            Aprovadores têm login web e decidem as despesas na plataforma. Um convite de acesso será enviado por e-mail.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <Field label="Nome completo" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Maria Souza" />
          </Field>
          <Field label="E-mail corporativo" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maria.souza@empresa.com.br" />
          </Field>
          <Field label="Função" required>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Gerente financeiro" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 90000-0000" />
          </Field>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Cadastrando…" : "Enviar convite"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
