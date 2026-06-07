import { useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { isAuthenticated, hasPolicyUploaded, markPolicyUploaded, getCurrentUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  Sparkles,
  ShieldCheck,
  ScanLine,
  CheckCircle2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configuração inicial · reembolso.ia.br" }] }),
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }
    // Já enviou a política? Então não precisa do onboarding.
    if (await hasPolicyUploaded()) {
      throw redirect({ to: "/overview" });
    }
  },
  component: OnboardingPage,
});

const MAX_MB = 10;
const ACCEPT = [".pdf", ".doc", ".docx"];

function OnboardingPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const validar = (f: File): string | undefined => {
    const ok = ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) return "Formato inválido. Envie um PDF, DOC ou DOCX.";
    if (f.size > MAX_MB * 1024 * 1024) return `Arquivo acima de ${MAX_MB} MB.`;
    return undefined;
  };

  const selecionar = (f: File | null) => {
    if (!f) return;
    const e = validar(f);
    setErro(e);
    setFile(e ? null : f);
  };

  const concluir = async () => {
    if (!file) return;
    setEnviando(true);
    try {
      await api.uploadPolicy(file.name, user?.nome ?? "Admin");
      await markPolicyUploaded(file.name);
      toast.success("Política ativada", {
        description: "A IA já pode avaliar despesas com base nas suas regras.",
      });
      navigate({ to: "/overview" });
    } catch {
      setEnviando(false);
      toast.error("Não foi possível enviar agora. Tente novamente.");
    }
  };

  return (
    <div className="min-h-svh bg-secondary/30">
      <div className="mx-auto grid min-h-svh w-full max-w-6xl gap-0 px-6 py-10 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-center lg:gap-16">
        {/* Lado esquerdo: por que isso importa */}
        <div className="space-y-8">
          <Logo withTagline className="h-10" />
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" /> Último passo para começar
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Envie sua política de reembolso
            </h1>
            <p className="max-w-md text-muted-foreground">
              É a peça-chave do sistema: a IA lê cada comprovante e cita a cláusula da{" "}
              <strong className="text-foreground">sua</strong> política para aprovar, reprovar ou
              pedir ajuste. Sem ela, não há análise automática.
            </p>
          </div>

          <ul className="space-y-4">
            <Passo icon={FileText} titulo="Você envia o documento" texto="PDF, DOC ou DOCX com as regras de reembolso da empresa." />
            <Passo icon={ScanLine} titulo="A IA estrutura as regras" texto="Limites por categoria, exigências de comprovante e exceções." />
            <Passo icon={ShieldCheck} titulo="Cada decisão fica justificada" texto="Toda recomendação cita a cláusula e a versão vigente." />
          </ul>
        </div>

        {/* Lado direito: upload */}
        <div className="rounded-2xl border border-border bg-background p-6 shadow-lg sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Documento da política</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.company.razao_social ?? "Sua empresa"}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                selecionar(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "mt-5 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging ? "border-brand bg-brand/5" : "border-border bg-secondary/30 hover:bg-secondary/50",
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                <UploadCloud className="h-7 w-7 text-brand" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Arraste o arquivo ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, DOC ou DOCX · até {MAX_MB} MB</p>
            </button>
          ) : (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                <FileText className="h-5 w-5 text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                aria-label="Remover arquivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}

          <Button onClick={concluir} disabled={!file || enviando} className="mt-6 w-full gap-2" size="lg">
            {enviando ? (
              "Ativando política…"
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Ativar e entrar no sistema
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Você poderá publicar novas versões a qualquer momento na tela de Política.
          </p>
        </div>
      </div>
    </div>
  );
}

function Passo({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: typeof FileText;
  titulo: string;
  texto: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </li>
  );
}
