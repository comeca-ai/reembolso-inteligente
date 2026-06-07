import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      setError("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setError("As senhas não conferem.");
      return;
    }

    setError(undefined);
    setLoading(true);
    try {
      await updatePassword(senha);
      toast.success("Senha alterada", {
        description: "Entre novamente com a nova senha.",
      });
      navigate({ to: "/login" });
    } catch {
      toast.error("Não foi possível alterar a senha", {
        description: "Abra novamente o link de recuperação e tente outra vez.",
      });
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Recuperação de acesso"
      title="Criar nova senha"
      subtitle="Defina uma senha nova para voltar ao painel."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
          <Input
            id="confirmarSenha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
