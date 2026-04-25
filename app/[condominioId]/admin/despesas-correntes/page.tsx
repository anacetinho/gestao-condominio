import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatData, formatEuros } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function DespesasCorrentesPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const despesas = await prisma.despesaCorrente.findMany({
    where: { condominioId },
    orderBy: { data: "desc" },
    take: 100,
  });

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const descricao = String(formData.get("descricao") ?? "").trim();
    const valor = Number(formData.get("valor"));
    const dataStr = String(formData.get("data") ?? "");
    const categoria = String(formData.get("categoria") ?? "").trim() || null;
    if (!descricao || !valor || !dataStr) throw new Error("Dados inválidos");

    const d = await prisma.despesaCorrente.create({
      data: {
        condominioId,
        descricao,
        valorCents: Math.round(valor * 100),
        data: new Date(dataStr),
        categoria,
      },
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.DESPESA_CORRENTE_CRIADA,
      entityType: "DespesaCorrente",
      entityId: d.id,
      payload: { descricao, valor },
    });
    redirect(`/${condominioId}/admin/despesas-correntes`);
  }

  async function anular(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const id = String(formData.get("id"));
    const motivo = String(formData.get("motivo") ?? "").trim() || null;
    const d = await prisma.despesaCorrente.findUnique({ where: { id } });
    if (!d) throw new Error("Não encontrada");
    const ageMs = Date.now() - d.createdAt.getTime();
    const ageHours = ageMs / 1000 / 60 / 60;
    if (ageHours > 24 && !motivo) {
      throw new Error("Motivo obrigatório para despesas com mais de 24h");
    }
    await prisma.despesaCorrente.update({
      where: { id },
      data: { anuladaEm: new Date(), anuladaMotivo: motivo },
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.DESPESA_CORRENTE_ANULADA,
      entityType: "DespesaCorrente",
      entityId: id,
      payload: { motivo },
    });
    redirect(`/${condominioId}/admin/despesas-correntes`);
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Despesas correntes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova despesa corrente</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={criar} className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="valor">Valor (€)</Label>
              <Input id="valor" name="valor" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={hoje} required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="categoria">Categoria (opcional)</Label>
              <Input id="categoria" name="categoria" placeholder="Ex: Limpeza" />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">Gravar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {despesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {despesas.map((d) => (
                <div
                  key={d.id}
                  className="border-b last:border-0 py-2 flex justify-between items-start gap-4"
                >
                  <div>
                    <p className={`font-medium ${d.anuladaEm ? "line-through opacity-60" : ""}`}>
                      {d.descricao}
                    </p>
                    <p className="text-muted-foreground">
                      {formatData(d.data)}
                      {d.categoria ? ` · ${d.categoria}` : ""}
                      {d.anuladaEm
                        ? ` · ANULADA${d.anuladaMotivo ? ` — ${d.anuladaMotivo}` : ""}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-medium">{formatEuros(d.valorCents)}</p>
                    {!d.anuladaEm && (
                      <form action={anular} className="flex gap-1">
                        <input type="hidden" name="id" value={d.id} />
                        <Input name="motivo" placeholder="Motivo (se >24h)" className="h-8" />
                        <Button type="submit" variant="outline" size="sm">
                          Anular
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
