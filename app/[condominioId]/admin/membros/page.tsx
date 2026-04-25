import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { criarConvite } from "@/lib/auth/invite";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatData } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function MembrosPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const [fracoes, memberships, convitesPendentes] = await Promise.all([
    prisma.fracao.findMany({
      where: { condominioId },
      orderBy: { identificador: "asc" },
      include: { memberships: { include: { user: true } } },
    }),
    prisma.membership.findMany({
      where: { condominioId, leftAt: null },
      include: { user: true, fracao: true },
    }),
    prisma.convite.findMany({
      where: { condominioId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  async function criarFracao(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const identificador = String(formData.get("identificador") ?? "").trim();
    const permilagem = Number(formData.get("permilagem") ?? 0);
    if (!identificador || !permilagem || permilagem <= 0) {
      throw new Error("Dados inválidos");
    }
    const f = await prisma.fracao.create({
      data: { condominioId, identificador, permilagem },
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.FRACAO_CRIADA,
      entityType: "Fracao",
      entityId: f.id,
      payload: { identificador, permilagem },
    });
    redirect(`/${condominioId}/admin/membros`);
  }

  async function convidar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const fracaoId = String(formData.get("fracaoId") ?? "") || null;
    const role = String(formData.get("role") ?? Role.MORADOR) as Role;
    if (!email) throw new Error("Email obrigatório");

    await criarConvite({
      condominioId,
      email,
      fracaoId,
      role,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.CONVITE_ENVIADO,
      payload: { email, role, fracaoId },
    });
    redirect(`/${condominioId}/admin/membros`);
  }

  const totalPermilagem = fracoes.reduce((s, f) => s + f.permilagem, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Membros</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            Frações{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · soma permilagens: {totalPermilagem}/1000
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={criarFracao} className="flex gap-2 flex-wrap items-end mb-4">
            <div className="space-y-1">
              <Label htmlFor="identificador">Identificador</Label>
              <Input id="identificador" name="identificador" placeholder="1ºA" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="permilagem">Permilagem</Label>
              <Input id="permilagem" name="permilagem" type="number" min={1} placeholder="125" />
            </div>
            <Button type="submit">Adicionar fração</Button>
          </form>
          <div className="space-y-2 text-sm">
            {fracoes.map((f) => (
              <div
                key={f.id}
                className="border-b last:border-0 py-2 flex justify-between items-center"
              >
                <span>
                  <b>{f.identificador}</b>{" "}
                  <span className="text-muted-foreground">· permilagem {f.permilagem}</span>
                </span>
                <span className="text-muted-foreground">
                  {f.memberships[0]?.user.nome ?? "(sem morador)"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convidar morador / admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={convidar} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fracaoId">Fração (opcional)</Label>
              <select
                id="fracaoId"
                name="fracaoId"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— sem fração —</option>
                {fracoes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.identificador}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Papel</Label>
              <select
                id="role"
                name="role"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={Role.MORADOR}
              >
                <option value={Role.MORADOR}>Morador</option>
                <option value={Role.ADMINISTRADOR}>Administrador</option>
              </select>
            </div>
            <Button type="submit">Enviar convite</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="border-b last:border-0 py-2 flex justify-between items-center"
              >
                <span>
                  <b>{m.user.nome}</b>{" "}
                  <span className="text-muted-foreground">
                    · {m.user.email}
                    {m.fracao ? ` · ${m.fracao.identificador}` : ""}
                  </span>
                </span>
                <Badge variant={m.role === Role.ADMINISTRADOR ? "default" : "secondary"}>
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {convitesPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {convitesPendentes.map((c) => (
                <div key={c.id} className="border-b last:border-0 py-2 flex justify-between">
                  <span>{c.email}</span>
                  <span className="text-muted-foreground">expira em {formatData(c.expiresAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
