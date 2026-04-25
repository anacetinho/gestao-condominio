import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, EstadoReuniao, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ReunioesPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const reunioes = await prisma.reuniao.findMany({
    where: { condominioId },
    orderBy: { data: "desc" },
    include: { _count: { select: { decisoes: true } } },
  });

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const titulo = String(formData.get("titulo") ?? "").trim();
    const dataStr = String(formData.get("data") ?? "");
    const local = String(formData.get("local") ?? "").trim() || null;
    const ordem = String(formData.get("ordemDoDia") ?? "").trim();
    if (!titulo || !dataStr || !ordem) throw new Error("Dados inválidos");

    const r = await prisma.reuniao.create({
      data: {
        condominioId,
        titulo,
        data: new Date(dataStr),
        local,
        ordemDoDia: ordem,
      },
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.REUNIAO_CRIADA,
      entityType: "Reuniao",
      entityId: r.id,
      payload: { titulo, data: dataStr },
    });
    redirect(`/${condominioId}/reunioes/${r.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reuniões</h1>

      {isAdmin(ctx) && (
        <Card>
          <CardHeader>
            <CardTitle>Nova convocatória</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={criar} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" name="titulo" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" name="data" type="datetime-local" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="local">Local</Label>
                  <Input id="local" name="local" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ordemDoDia">Ordem do dia</Label>
                <textarea
                  id="ordemDoDia"
                  name="ordemDoDia"
                  required
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit">Convocar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {reunioes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem reuniões.</p>
        ) : (
          reunioes.map((r) => (
            <Link key={r.id} href={`/${condominioId}/reunioes/${r.id}`}>
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDataHora(r.data)}
                      {r.local ? ` · ${r.local}` : ""} · {r._count.decisoes} decisão(ões)
                    </p>
                  </div>
                  <Badge
                    variant={
                      r.estado === EstadoReuniao.REALIZADA
                        ? "success"
                        : r.estado === EstadoReuniao.CANCELADA
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {r.estado}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
