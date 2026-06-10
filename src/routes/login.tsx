import { useState } from "react";
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { signIn, isAuthenticated, sendPasswordReset } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    if (await isAuthenticated()) {
      throw redirect({ to: "/overview" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "E-mail inválido.";
    if (!senha) next.senha = "Informe sua senha.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await signIn({ email, senha });
      toast.success("Bem-vindo ao reembolso.ia.br", {
        description: `Acesso liberado para ${user.nome}.`,
      });
      navigate({ to: "/overview" });
    } catch {
      toast.error("Não foi possível entrar", {
        description: "Verifique suas credenciais e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors((current) => ({
        ...current,
        email: "Informe seu e-mail para recuperar a senha.",
      }));
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordReset({ email });
      toast.success("E-mail de recuperação enviado", {
        description: "Abra o link recebido para cadastrar uma nova senha.",
      });
    } catch {
      toast.error("Não foi possível enviar a recuperação", {
        description: "Confira o e-mail e tente novamente.",
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Acesso ao painel"
      title="Entrar na sua conta"
      subtitle="Acompanhe os reembolsos da sua equipe de campo em um só lugar."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@suaempresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="senha">Senha</Label>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="text-xs font-medium text-brand hover:underline"
            >
              {resetLoading ? "Enviando…" : "Esqueci minha senha"}
            </button>
          </div>
          <div className="relative">
            <Input
              id="senha"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={!!errors.senha}
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
          {errors.senha && <p className="text-xs text-destructive">{errors.senha}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/signup" className="font-semibold text-brand hover:underline">
          Configurar a solução
        </Link>
      </p>
    </AuthLayout>
  );
}
