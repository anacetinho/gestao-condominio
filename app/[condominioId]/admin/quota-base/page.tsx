import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, ModoQuota, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatData, formatEuros } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function QuotaBasePage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const [fracoes, configs] = await Promise.all([
    prisma.fracao.findMany({
      where: { condominioId },
      orderBy: { identificador: "asc" },
    }),
    prisma.configuracaoQuota.findMany({
      where: { condominioId },
      orderBy: { vigenteDesde: "desc" },
    }),
  ]);

  async function gravar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");

    const modo = String(formData.get("modo") ?? "VALOR_UNICO") as
      | typeof ModoQuota.VALOR_UNICO
      | typeof ModoQuota.PERMILAGEM
      | typeof ModoQuota.MANUAL;
    const vigenteDesde = new Date(String(formData.get("vigenteDesde")));

    let valorUnicoCents: number | null = null;
    let valoresPorFracao: Record<string, number> | null = null;

    if (modo === ModoQuota.VALOR_UNICO) {
      const eur = Number(formData.get("valorUnico"));
      if (!eur || eur <= 0) throw new Error("Valor único inválido");
      valorUnicoCents = Math.round(eur * 100);
    } else if (modo === ModoQuota.PERMILAGEM) {
      const eur = Number(formData.get("totalMensal"));
      if (!eur || eur <= 0) throw new Error("Total mensal inválido");
      const totalCents = Math.round(eur * 100);
      valoresPorFracao = {};
      let acumulado = 0;
      for (let i = 0; i < fracoes.length; i++) {
        const f = fracoes[i];
        if (i === fracoes.length - 1) {
          valoresPorFracao[f.id] = totalCents - acumulado;
        } else {
          const v = Math.floor((totalCents * f.permilagem) / 1000);
          valoresPorFracao[f.id] = v;
          acumulado += v;
        }
      }
    } else {
      valoresPorFracao = {};
      for (const f of fracoes) {
        const eur = Number(formData.get(`fr_${f.id}`));
        if (!eur || eur < 0) throw new Error(`Valor inválido para ${f.identificador}`);
        valoresPorFracao[f.id] = Math.round(eur * 100);
      }
    }

    // Fecha config anterior.
    await prisma.configuracaoQuota.updateMany({
      where: { condominioId, vigenteAte: null },
      data: { vigenteAte: vigenteDesde },
    });
    const cfg = await prisma.configuracaoQuota.create({
      data: {
        condominioId,
        modo,
        vigenteDesde,
        valorUnicoCents,
        valoresPorFracao: valoresPorFracao ? JSON.stringify(valoresPorFracao) : null,
      },
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.QUOTA_BASE_ALTERADA,
      entityType: "ConfiguracaoQuota",
      entityId: cfg.id,
      payload: { modo, vigenteDesde: vigenteDesde.toISOString() },
    });
    redirect(`/${condominioId}/admin/quota-base`);
  }

  const proxMes = new Date();
  proxMes.setUTCMonth(proxMes.getUTCMonth() + 1);
  proxMes.setUTCDate(1);
  const proxMesISO = proxMes.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quota base</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={gravar} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="modo">Modo</Label>
              <select
                id="modo"
                name="modo"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={ModoQuota.VALOR_UNICO}
              >
                <option value={ModoQuota.VALOR_UNICO}>
                  Valor único (igual para todas as frações)
                </option>
                <option value={ModoQuota.PERMILAGEM}>Permilagem (rateio por permilagem)</option>
                <option value={ModoQuota.MANUAL}>Manual (definir valor por fração)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vigenteDesde">Vigente desde</Label>
              <Input
                id="vigenteDesde"
                name="vigenteDesde"
                type="date"
                defaultValue={proxMesISO}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorUnico">Valor único (€/mês)</Label>
              <Input id="valorUnico" name="valorUnico" type="number" step="0.01" min="0" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalMensal">Total mensal a recolher (€)</Label>
              <Input id="totalMensal" name="totalMensal" type="number" step="0.01" min="0" />
              <p className="text-xs text-muted-foreground">
                (Para modo Permilagem — distribuído pelas frações.)
              </p>
            </div>

            {fracoes.length > 0 && (
              <div className="space-y-2">
                <Label>Valores manuais por fração (€)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {fracoes.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="text-sm w-12">{f.identificador}</span>
                      <Input name={`fr_${f.id}`} type="number" step="0.01" min="0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit">Gravar configuração</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma configuração ainda. Defina a primeira acima.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {configs.map((c) => (
                <div key={c.id} className="border-b last:border-0 py-2 flex justify-between">
                  <div>
                    <p className="font-medium">{c.modo}</p>
                    <p className="text-muted-foreground">
                      Desde {formatData(c.vigenteDesde)}
                      {c.vigenteAte ? ` até ${formatData(c.vigenteAte)}` : " · activa"}
                    </p>
                  </div>
                  <p>
                    {c.modo === ModoQuota.VALOR_UNICO
                      ? `${formatEuros(c.valorUnicoCents ?? 0)} / fração`
                      : "Por fração (ver detalhe)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
