import { useState } from "react";
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff, Check, X, Circle } from "lucide-react";
import {
  signUpCompany,
  isAuthenticated,
  SIGN_UP_STEPS,
  SIGN_UP_STEP_LABELS,
  SignUpStepError,
  type SignUpStep,
} from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  ssr: false,
  beforeLoad: async () => {
    if (await isAuthenticated()) {
      throw redirect({ to: "/overview" });
    }
  },
  component: SignupPage,
});

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

type FormState = {
  razaoSocial: string;
  cnpj: string;
  nomeResponsavel: string;
  email: string;
  whatsapp: string;
  senha: string;
  confirmarSenha: string;
  aceite: boolean;
};

type Errors = Partial<Record<keyof FormState, string>>;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    razaoSocial: "",
    cnpj: "",
    nomeResponsavel: "",
    email: "",
    whatsapp: "",
    senha: "",
    confirmarSenha: "",
    aceite: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<SignUpStep | null>(null);
  const [failedStep, setFailedStep] = useState<SignUpStep | null>(null);
  const [failedMessage, setFailedMessage] = useState<string>("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next: Errors = {};
    if (!form.razaoSocial.trim()) next.razaoSocial = "Informe a razão social.";
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (!cnpjDigits) next.cnpj = "Informe o CNPJ.";
    else if (cnpjDigits.length !== 14) next.cnpj = "CNPJ deve ter 14 dígitos.";
    if (!form.nomeResponsavel.trim()) next.nomeResponsavel = "Informe o responsável.";
    if (!form.email.trim()) next.email = "Informe o e-mail corporativo.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "E-mail inválido.";
    if (!form.whatsapp.replace(/\D/g, "")) next.whatsapp = "Informe o WhatsApp.";
    if (!form.senha) next.senha = "Crie uma senha.";
    else if (form.senha.length < 8) next.senha = "Mínimo de 8 caracteres.";
    if (form.confirmarSenha !== form.senha)
      next.confirmarSenha = "As senhas não conferem.";
    if (!form.aceite) next.aceite = "É necessário aceitar os termos.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signUpCompany({
        razaoSocial: form.razaoSocial,
        cnpj: form.cnpj,
        nomeResponsavel: form.nomeResponsavel,
        email: form.email,
        whatsapp: form.whatsapp,
        senha: form.senha,
      });

      if (result.status === "confirmation_required") {
        toast.success("Quase lá! Confirme seu e-mail", {
          description: `Enviamos um link de confirmação para ${form.email.trim()}. Confirme para acessar o painel.`,
        });
        navigate({ to: "/login" });
        return;
      }

      toast.success("Conta piloto criada!", {
        description: `${form.razaoSocial} está pronta. Vamos ao painel.`,
      });
      navigate({ to: "/overview" });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "";
      let description = "Tente novamente em instantes.";
      if (/weak|pwned|password/i.test(message)) {
        description =
          "Essa senha é muito comum ou apareceu em vazamentos. Crie uma senha mais forte e única.";
      } else if (/already registered|already been registered|user already/i.test(message)) {
        description = "Este e-mail já possui conta. Tente entrar ou recuperar a senha.";
      } else if (/network|fetch|failed to fetch/i.test(message)) {
        description = "Falha de conexão. Verifique sua internet e tente novamente.";
      }
      toast.error("Não foi possível criar a conta", { description });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Programa Piloto"
      title="Criar conta piloto"
      subtitle="Cadastre sua empresa e o primeiro administrador para começar a testar."
    >
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <Field label="Razão social" error={errors.razaoSocial}>
          <Input
            placeholder="Sua Empresa Ltda."
            value={form.razaoSocial}
            onChange={(e) => set("razaoSocial", e.target.value)}
            aria-invalid={!!errors.razaoSocial}
          />
        </Field>

        <Field label="CNPJ" error={errors.cnpj}>
          <Input
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            value={form.cnpj}
            onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
            aria-invalid={!!errors.cnpj}
          />
        </Field>

        <Field label="Nome do responsável" error={errors.nomeResponsavel}>
          <Input
            placeholder="Maria Silva"
            value={form.nomeResponsavel}
            onChange={(e) => set("nomeResponsavel", e.target.value)}
            aria-invalid={!!errors.nomeResponsavel}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail corporativo" error={errors.email}>
            <Input
              type="email"
              placeholder="voce@empresa.com.br"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp}>
            <Input
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
              aria-invalid={!!errors.whatsapp}
            />
          </Field>
        </div>

        <Field label="Senha" error={errors.senha}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo de 8 caracteres"
              value={form.senha}
              onChange={(e) => set("senha", e.target.value)}
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
        </Field>

        <Field label="Confirmar senha" error={errors.confirmarSenha}>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Repita a senha"
            value={form.confirmarSenha}
            onChange={(e) => set("confirmarSenha", e.target.value)}
            aria-invalid={!!errors.confirmarSenha}
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="aceite"
              checked={form.aceite}
              onCheckedChange={(v) => set("aceite", v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="aceite" className="text-sm font-normal leading-snug text-muted-foreground">
              Li e aceito os termos de uso e a política de privacidade (LGPD) do
              reembolso.ia.br.
            </Label>
          </div>
          {errors.aceite && <p className="text-xs text-destructive">{errors.aceite}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Criando conta…" : "Criar conta piloto"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
