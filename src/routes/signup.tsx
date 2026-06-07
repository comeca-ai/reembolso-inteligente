import { useState } from "react";
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff, Paperclip, FileText, X } from "lucide-react";
import { signUpCompany, isAuthenticated } from "@/lib/auth";

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
  const [politica, setPolitica] = useState<File | null>(null);
  const [politicaErro, setPoliticaErro] = useState<string | undefined>(undefined);
  const [cartaoCnpj, setCartaoCnpj] = useState<File | null>(null);
  const [cartaoCnpjErro, setCartaoCnpjErro] = useState<string | undefined>(undefined);

  const MAX_POLITICA_MB = 10;
  const TIPOS_ACEITOS = [".pdf", ".doc", ".docx"];
  const TIPOS_CARTAO = [".pdf", ".jpg", ".jpeg", ".png"];

  function handlePoliticaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPoliticaErro(undefined);
    if (!file) {
      setPolitica(null);
      return;
    }
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!TIPOS_ACEITOS.includes(ext)) {
      setPoliticaErro("Envie um arquivo PDF, DOC ou DOCX.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_POLITICA_MB * 1024 * 1024) {
      setPoliticaErro(`Arquivo muito grande (máx. ${MAX_POLITICA_MB} MB).`);
      e.target.value = "";
      return;
    }
    setPolitica(file);
  }

  function handleCartaoCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCartaoCnpjErro(undefined);
    if (!file) {
      setCartaoCnpj(null);
      return;
    }
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!TIPOS_CARTAO.includes(ext)) {
      setCartaoCnpjErro("Envie um arquivo PDF, JPG ou PNG.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_POLITICA_MB * 1024 * 1024) {
      setCartaoCnpjErro(`Arquivo muito grande (máx. ${MAX_POLITICA_MB} MB).`);
      e.target.value = "";
      return;
    }
    setCartaoCnpj(file);
  }

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
    let cartaoOk = true;
    if (!cartaoCnpj) {
      setCartaoCnpjErro("Envie o Cartão do CNPJ.");
      cartaoOk = false;
    }
    return Object.keys(next).length === 0 && cartaoOk;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await signUpCompany({
        razaoSocial: form.razaoSocial,
        cnpj: form.cnpj,
        nomeResponsavel: form.nomeResponsavel,
        email: form.email,
        whatsapp: form.whatsapp,
        senha: form.senha,
        politicaReembolsoArquivo: politica?.name,
        cartaoCnpjArquivo: cartaoCnpj?.name,
      });
      toast.success("Conta piloto criada!", {
        description: `${form.razaoSocial} está pronta. Vamos ao painel.`,
      });
      navigate({ to: "/overview" });
    } catch {
      toast.error("Não foi possível criar a conta", {
        description: "Tente novamente em instantes.",
      });
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
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="politica">Política de reembolso</Label>
            <span className="text-xs text-muted-foreground">Opcional</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie o seu plano/política de reembolso (PDF, DOC ou DOCX). É o
            documento que a IA usa para avaliar as despesas. Você também pode
            enviar depois, na tela de Política.
          </p>

          {politica ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate">{politica.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setPolitica(null);
                  setPoliticaErro(undefined);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Remover arquivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="politica"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
              Selecionar arquivo (até {MAX_POLITICA_MB} MB)
            </label>
          )}
          <input
            id="politica"
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={handlePoliticaChange}
          />
          {politicaErro && <p className="text-xs text-destructive">{politicaErro}</p>}
        </div>



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
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
