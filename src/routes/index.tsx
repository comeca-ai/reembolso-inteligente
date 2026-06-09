import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import {
  MessageCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Clock,
  FileCheck2,
  TrendingDown,
  Eye,
  CheckCircle2,
  ArrowRight,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "reembolso.ia.br — Do comprovante no WhatsApp ao reembolso pronto pra pagar",
      },
      {
        name: "description",
        content:
          "A equipe manda o comprovante pelo WhatsApp. A IA confere com a sua política e devolve o reembolso pronto pra pagar: valor conferido, chave PIX na tela e trilha de auditoria. O aprovador só dá o ok.",
      },
      { property: "og:title", content: "reembolso.ia.br — Reembolso pronto pra pagar, não mais uma planilha" },
      {
        property: "og:description",
        content:
          "Infraestrutura de reembolso para equipes de campo: WhatsApp, IA explicável, política versionada e LGPD por padrão.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <Hero />
      <TrustBar />
      <Advantages />
      <HowItWorks />
      <ResultsBand />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="reembolso.ia.br">
          <Logo className="h-7 sm:h-8" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#vantagens" className="transition-colors hover:text-foreground">
            Vantagens
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
          <a href="#resultados" className="transition-colors hover:text-foreground">
            Resultados
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Criar conta piloto</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(110% 80% at 85% 0%, oklch(0.55 0.09 200 / 0.35), transparent 55%), radial-gradient(90% 70% at 0% 100%, oklch(0.70 0.10 192 / 0.18), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div className="animate-fade-rise">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-sidebar-foreground sm:text-5xl">
            Reembolsos da sua equipe de campo,{" "}
            <span className="text-sidebar-primary">resolvidos no automático.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-sidebar-foreground/80 sm:text-lg">
            O colaborador manda o comprovante pelo WhatsApp. A IA lê os dados,
            compara com a sua política e entrega uma recomendação clara. O
            aprovador decide em segundos — com trilha de auditoria e LGPD por
            padrão.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-base">
              <Link to="/signup">
                Criar conta piloto
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-sidebar-border/70 bg-transparent text-base text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <Link to="/login">Já sou cliente</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sidebar-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sidebar-primary" />
              Sem cartão de crédito
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sidebar-primary" />
              Implantação em dias
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sidebar-primary" />
              Conformidade LGPD
            </span>
          </div>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="animate-fade-rise [animation-delay:120ms]">
      <div className="relative mx-auto max-w-md rounded-2xl border border-sidebar-border/60 bg-card p-5 text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
              <ScanLine className="h-4 w-4" />
            </span>
            Comprovante recebido
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
            via WhatsApp
          </span>
        </div>

        <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-4">
          <Row label="Estabelecimento" value="Restaurante Bom Prato · Av. Paulista" />
          <Row label="Categoria" value="Alimentação / Refeição" />
          <Row label="Valor" value="R$ 87,50" strong />
          <Row label="Confiança da extração" value="98%" accent />
        </div>

        <div className="mt-4 rounded-xl border border-success/25 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <Sparkles className="h-4 w-4" />
            Recomendação da IA: Aprovar
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Dentro do teto de alimentação (R$ 120/dia) e com CNPJ válido. Nenhuma
            regra da política v3.2 foi violada.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="flex-1 rounded-lg bg-brand py-2.5 text-center text-sm font-semibold text-brand-foreground">
            Aprovar
          </div>
          <div className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium text-foreground">
            Ressalva
          </div>
          <div className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium text-foreground">
            Recusar
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          accent
            ? "font-semibold text-brand"
            : strong
              ? "text-base font-semibold text-foreground"
              : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-b border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-xs font-medium text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-brand" /> Trilha de auditoria
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileCheck2 className="h-4 w-4 text-brand" /> Política versionada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-brand" /> Decisão humana
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-brand" /> WhatsApp & e-mail
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-brand" /> Conformidade LGPD
        </span>
      </div>
    </section>
  );
}

const advantages = [
  {
    icon: Clock,
    title: "Aprovação em segundos",
    desc: "A IA pré-analisa cada comprovante e entrega tudo mastigado. O aprovador só confirma.",
  },
  {
    icon: TrendingDown,
    title: "Menos gasto fora da política",
    desc: "Tetos, categorias e regras aplicados automaticamente. O que está fora é bloqueado na hora.",
  },
  {
    icon: ScanLine,
    title: "Extração automática",
    desc: "Valor, data, CNPJ e estabelecimento lidos do recibo — sem digitação manual.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoria e LGPD",
    desc: "Cada decisão fica registrada com quem, quando e por quê. Pronto para auditoria.",
  },
  {
    icon: MessageCircle,
    title: "Onde a equipe já está",
    desc: "Seu time de campo envia pelo WhatsApp ou e-mail. Zero app novo para aprender.",
  },
  {
    icon: Sparkles,
    title: "IA explicável",
    desc: "A recomendação sempre cita a regra da política. Nada de caixa-preta.",
  },
];

function Advantages() {
  return (
    <section id="vantagens" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">
          Vantagens
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Tudo que o financeiro precisa, sem a papelada de sempre
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Da chegada do comprovante ao reembolso aprovado, com controle total e
          decisão sempre humana.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {advantages.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.title}
              className="card-hover rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {a.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const steps = [
  {
    icon: MessageCircle,
    title: "1. A equipe envia",
    desc: "O colaborador tira foto do comprovante e manda pelo WhatsApp ou e-mail. Acabou.",
  },
  {
    icon: ScanLine,
    title: "2. A IA analisa",
    desc: "Os dados são extraídos e comparados com a sua política. Sai uma recomendação explicável.",
  },
  {
    icon: CheckCircle2,
    title: "3. Você decide",
    desc: "O aprovador confirma, aprova com ressalva ou recusa — tudo registrado para auditoria.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Como funciona
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Três passos. Sem planilha, sem fila de e-mail.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="relative rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const metrics = [
  { value: "3,4h", label: "Tempo médio de aprovação" },
  { value: "97%", label: "Confiança média da extração" },
  { value: "100%", label: "Decisões com trilha de auditoria" },
  { value: "0", label: "Apps novos para a equipe de campo" },
];

function ResultsBand() {
  return (
    <section id="resultados" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4 lg:p-10">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-4xl font-semibold tracking-tight text-brand tabular-nums">
              {m.value}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-sidebar px-6 py-14 text-center text-sidebar-foreground sm:px-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(90% 120% at 50% 0%, oklch(0.55 0.09 200 / 0.35), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-sidebar-foreground sm:text-4xl">
            Comece o piloto com a sua empresa
          </h2>
          <p className="mt-3 text-base text-sidebar-foreground/80">
            Cadastre sua empresa e o primeiro administrador em poucos minutos.
            Sem cartão de crédito, com suporte na implantação.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-base">
              <Link to="/signup">
                Criar conta piloto
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-sidebar-border/70 bg-transparent text-base text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <Link to="/login">Entrar na conta</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Logo className="h-7" />
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} reembolso.ia.br · IA explicável com decisão humana · LGPD
        </p>
      </div>
    </footer>
  );
}
