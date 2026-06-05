import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { api, formatBRL, type AppUser, type UserRole } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const usersQuery = queryOptions({ queryKey: ["users"], queryFn: () => api.listUsers() });

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Cadastros · reembolsa.aí" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery),
  component: UsersPage,
});

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function UsersPage() {
  const { data } = useSuspenseQuery(usersQuery);
  const [tab, setTab] = useState<UserRole>("campo");
  const list = data.filter((u) => u.role === tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastros"
        description="Equipe de campo que envia comprovantes e aprovadores que decidem na plataforma."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as UserRole)}>
        <TabsList>
          <TabsTrigger value="campo">
            Equipe de campo
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {data.filter((u) => u.role === "campo").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="aprovador">
            Aprovadores
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {data.filter((u) => u.role === "aprovador").length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Equipe</th>
                <th className="px-4 py-2.5 font-medium">Centro de custo</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                {tab === "campo" && <th className="px-4 py-2.5 text-right font-medium">Limite mensal</th>}
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((u: AppUser) => (
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
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.team}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.costCenter}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.phone ?? "—"}</td>
                  {tab === "campo" && (
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {u.monthlyLimit ? formatBRL(u.monthlyLimit) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        u.status === "ativo"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          u.status === "ativo" ? "bg-success" : "bg-muted-foreground",
                        )}
                      />
                      {u.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
