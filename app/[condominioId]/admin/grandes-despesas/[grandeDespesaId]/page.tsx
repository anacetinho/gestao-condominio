import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSession } from "@/lib/auth/session";
import { EstadoGrandeDespesa, EstadoImputacao, EstadoReuniao, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  anularGrandeDespesa,
  associarReuniao,
  executarGrandeDespesa,
} from "@/lib/grandes-despesas/workflow";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function GrandeDespesaDetalhe({
  params,
}: {
  params: Promise<{ condominioId: string; grandeDespesaId: string }>;
}) {
  const session = await requireSession();
  const { condominioId, grandeDespesaId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const gd = await prisma.grandeDespesa.findFirst({
    where: { id: grandeDespesaId, condominioId },
    include: {
      decisao: { include: { reuniao: true } },
      imputacoes: {
        include: { fracao: true, quotaMensal: true },
        orderBy: [{ anoAplicacao: "asc" }, { mesAplicacao: "asc" }],
      },
    },
  });
  if (!gd) notFound();

  const reunioesAgendadas = await prisma.reuniao.findMany({
    where: { condominioId, estado: EstadoReuniao.AGENDADA },
    orderBy: { data: "asc" },
  });

  async function fazerAssociar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const reuniaoId = String(formData.get("reuniaoId"));
    if (!reuniaoId) throw new Error("Reunião obrigatória");
    await associarReuniao({
      grandeDespesaId,
      reuniaoId,
      membershipId: c.membershipId,
    });
    redirect(`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}`);
  }

  async function fazerExecutar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const valorFinal = Number(formData.get("valorFinal"));
    const nota = String(formData.get("nota") ?? "").trim() || undefined;
    if (!valorFinal || valorFinal <= 0) throw new Error("Valor inválido");
    await executarGrandeDespesa({
      grandeDespesaId,
      membershipId: c.membershipId,
      valorFinalCents: Math.round(valorFinal * 100),
      notaExecucao: nota,
    });
    redirect(`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}`);
  }

  async function fazerAnular(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const motivo = String(formData.get("motivo") ?? "").trim();
    const confirmacao = String(formData.get("confirmacao") ?? "");
    if (confirmacao !== "ANULAR") {
      throw new Error("Tem de escrever ANULAR para confirmar");
    }
    if (motivo.length < 5) throw new Error("Motivo é obrigatório (≥ 5 chars)");
    const r = await anularGrandeDespesa({
      grandeDespesaId,
      membershipId: c.membershipId,
      motivo,
    });
    if (r.aplicadasParaReembolso > 0) {
      redirect(`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}/reembolsos`);
    }
    redirect(`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}`);
  }

  const podeAssociar = gd.estado === EstadoGrandeDespesa.RASCUNHO;
  const podeExecutar = gd.estado === EstadoGrandeDespesa.APROVADA;
  const podeAnular =
    gd.estado === EstadoGrandeDespesa.APROVADA || gd.estado === EstadoGrandeDespesa.EXECUTADA;
  const temReembolsos =
    gd.estado === EstadoGrandeDespesa.ANULADA &&
    gd.imputacoes.some((i) => i.estado === EstadoImputacao.ANULADA && i.quotaMensalId !== null);

  const totalImputado = gd.imputacoes
    .filter((i) => i.estado !== EstadoImputacao.ANULADA)
    .reduce((s, i) => s + i.valorCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${condominioId}/admin/grandes-despesas`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Grandes despesas
        </Link>
        <h1 className="text-2xl font-bold mt-1">{gd.titulo}</h1>
        <Badge variant="outline">{gd.estado}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <b>{formatEuros(gd.valorTotalCents)}</b> ÷ {gd.numeroMeses} meses · Início{" "}
            {formatMesAno(gd.mesInicial, gd.anoInicial)} · Rateio: {gd.modoRateio}
          </p>
          <p className="whitespace-pre-wrap">{gd.descricao}</p>
          {gd.executadaEm && (
            <p className="text-muted-foreground">
              Executada em {formatData(gd.executadaEm)}
              {gd.valorFinalCents != null
                ? ` · valor final ${formatEuros(gd.valorFinalCents)}`
                : ""}
              {gd.notaExecucao ? ` — ${gd.notaExecucao}` : ""}
            </p>
          )}
          {gd.anuladaEm && (
            <p className="text-orange-600">
              ANULADA em {formatData(gd.anuladaEm)} — {gd.anuladaMotivo}
            </p>
          )}
        </CardContent>
      </Card>

      {gd.decisao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reunião associada</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/${condominioId}/reunioes/${gd.decisao.reuniaoId}`}
              className="hover:underline"
            >
              {gd.decisao.reuniao.titulo} — {formatData(gd.decisao.reuniao.data)}
            </Link>
            {gd.decisao.resultado && (
              <Badge variant="outline" className="ml-2">
                {gd.decisao.resultado}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {podeAssociar && (
        <Card>
          <CardHeader>
            <CardTitle>Associar a reunião</CardTitle>
          </CardHeader>
          <CardContent>
            {reunioesAgendadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há reuniões agendadas. Crie uma primeiro em{" "}
                <Link href={`/${condominioId}/reunioes`} className="underline">
                  Reuniões
                </Link>
                .
              </p>
            ) : (
              <form action={fazerAssociar} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="reuniaoId">Reunião</Label>
                  <select
                    id="reuniaoId"
                    name="reuniaoId"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {reunioesAgendadas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.titulo} — {formatData(r.data)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Associar</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {gd.imputacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Imputações ({gd.imputacoes.length}) ·{" "}
              <span className="text-sm font-normal">
                Total imputado: {formatEuros(totalImputado)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-1 max-h-64 overflow-y-auto">
              {gd.imputacoes.map((i) => (
                <div key={i.id} className="flex justify-between border-b py-1">
                  <span>
                    {i.fracao.identificador} · {formatMesAno(i.mesAplicacao, i.anoAplicacao)}
                  </span>
                  <span className="flex items-center gap-2">
                    {formatEuros(i.valorCents)}
                    <Badge variant="outline" className="text-[10px]">
                      {i.estado}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {podeExecutar && (
        <Card>
          <CardHeader>
            <CardTitle>Marcar como executada</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={fazerExecutar} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="valorFinal">Valor final (€)</Label>
                <Input
                  id="valorFinal"
                  name="valorFinal"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={(gd.valorTotalCents / 100).toFixed(2)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nota">Nota (obrigatória se desvio &gt; 5%)</Label>
                <Input id="nota" name="nota" />
              </div>
              <Button type="submit">Marcar como executada</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {podeAnular && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Anular grande despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={fazerAnular} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Imputações futuras (PENDENTES) serão removidas das próximas quotas. Imputações já
                APLICADAS (em quotas pagas) serão marcadas para reembolso — o reembolso é tratado
                pelo administrador <b>fora da aplicação</b>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo (obrigatório)</Label>
                <Input id="motivo" name="motivo" required minLength={5} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao">
                  Escreva <code className="font-mono">ANULAR</code> para confirmar
                </Label>
                <Input id="confirmacao" name="confirmacao" required />
              </div>
              <Button type="submit" variant="destructive">
                Confirmar anulação
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {temReembolsos && (
        <Card>
          <CardHeader>
            <CardTitle>Reembolsos a tratar</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${condominioId}/admin/grandes-despesas/${gd.id}/reembolsos`}>
                Ver reembolsos →
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
