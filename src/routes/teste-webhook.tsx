import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Upload, Send, Loader2, CheckCircle, XCircle, ImageIcon } from "lucide-react";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { landingForRole } from "@/lib/permissions";
import { getReimbursementsConfig } from "@/lib/reimbursements.functions";

export const Route = createFileRoute("/teste-webhook")({
  // Página de debug: só admin autenticado pode acessar (e ela envia o
  // webhook_token da empresa para o endpoint, que agora exige autenticação).
  ssr: false,
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }
    const role = getCurrentUser()?.role;
    if (role !== "admin") {
      throw redirect({ to: landingForRole(role) });
    }
  },
  head: () => ({
    meta: [
      { title: "Teste do Webhook — reembolso.ia.br" },
      { name: "description", content: "Página de teste do webhook de reembolsos" },
    ],
  }),
  component: TesteWebhookPage,
});

function TesteWebhookPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setBase64(dataUrl);
    };
    reader.readAsDataURL(selected);
  };

  const handleSend = async () => {
    if (!base64) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/public/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          sender: "teste@reembolso.ia.br",
          sender_name: "Teste Manual",
          channel: "email",
          message: "Teste via página de debug",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Erro na requisição");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="reembolso.ia.br">
            <Logo className="h-7 sm:h-8" />
          </a>
          <span className="text-xs font-medium text-muted-foreground">Debug / Teste Webhook</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Teste do Webhook de Reembolsos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Envie uma imagem de comprovante diretamente para o endpoint e veja a extração da IA.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* Upload */}
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="mx-auto max-h-64 rounded-xl object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <p className="text-sm font-medium">Clique para selecionar uma imagem</p>
                <p className="text-xs">JPEG, PNG, WEBP</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Trocar imagem
            </Button>
            <Button
              className="flex-1"
              disabled={!base64 || loading}
              onClick={handleSend}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar para o webhook
            </Button>
          </div>

          {/* Result */}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="h-4 w-4" />
                Erro
              </div>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle className="h-4 w-4" />
                Sucesso
              </div>
              <div className="mt-3 space-y-2 font-mono text-xs text-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span>{result.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recebido em:</span>
                  <span>{result.received_at}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <span>{result.ai?.amount ? `R$ ${result.ai.amount.toFixed(2)}` : "Não extraído"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categoria:</span>
                  <span className="capitalize">{result.ai?.category || "Não extraído"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="max-w-[200px] text-right">{result.ai?.description || "Não extraído"}</span>
                </div>
              </div>
              <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-background p-3 text-[11px] text-muted-foreground">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
