import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, completeMandatoryPasswordChange } from "@/lib/auth";

/**
 * Modal obrigatório exibido no primeiro acesso de usuários convidados, que
 * entraram com a senha temporária. Não pode ser fechado: o usuário só sai
 * depois de criar uma nova senha.
 */
export function ForcePasswordChangeDialog() {
  const user = getCurrentUser();
  const [open, setOpen] = useState(!!user?.mustChangePassword);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ senha?: string; confirma?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (senha.length < 8) next.senha = "A senha deve ter ao menos 8 caracteres.";
    if (confirma !== senha) next.confirma = "As senhas não conferem.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await completeMandatoryPasswordChange(senha);
      toast.success("Senha atualizada", {
        description: "Tudo pronto! Sua senha definitiva está ativa.",
      });
      setOpen(false);
    } catch {
      toast.error("Não foi possível atualizar a senha", {
        description: "Tente novamente em instantes.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!user?.mustChangePassword) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        className="[&>button]:hidden sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10">
            <KeyRound className="h-5 w-5 text-brand" />
          </div>
          <DialogTitle>Crie sua nova senha</DialogTitle>
          <DialogDescription>
            Você entrou com uma senha temporária. Defina uma senha pessoal para continuar usando o
            painel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={!!errors.senha}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.senha && <p className="text-xs text-destructive">{errors.senha}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirma-senha">Confirme a nova senha</Label>
            <Input
              id="confirma-senha"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              aria-invalid={!!errors.confirma}
            />
            {errors.confirma && <p className="text-xs text-destructive">{errors.confirma}</p>}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Salvando…" : "Salvar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
