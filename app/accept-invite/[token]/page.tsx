import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { consumirConvite } from "@/lib/auth/invite";
import { hashToken } from "@/lib/auth/invite";
import { getSession, setSession } from "@/lib/auth/session";
import { AuditAction } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const convite = await prisma.convite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { condominio: true },
  });

  if (!convite) {
    return (
      <main className="mx-auto max-w-md p-6 mt-16">
        <Card>
          <CardHeader>
            <CardTitle>Convite inválido</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Este convite não existe ou já foi usado.</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (convite.acceptedAt) {
    return (
      <main className="mx-auto max-w-md p-6 mt-16">
        <Card>
          <CardHeader>
            <CardTitle>Convite já usado</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Este convite já foi aceite. Pode fazer login.</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (convite.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-md p-6 mt-16">
        <Card>
          <CardHeader>
            <CardTitle>Convite expirado</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Peça ao administrador para enviar um novo convite.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  async function aceitar(formData: FormData) {
    "use server";
    const nome = String(formData.get("nome") ?? "").trim();
    if (!nome) throw new Error("Nome obrigatório");

    const { user, membership } = await consumirConvite(token, {
      email: convite!.email,
      nome,
    });
    await recordAudit({
      condominioId: membership.condominioId,
      membershipId: membership.id,
      action: AuditAction.CONVITE_ACEITE,
      payload: { email: user.email },
    });
    await setSession(user.id);
    redirect(`/${membership.condominioId}/dashboard`);
  }

  const session = await getSession();

  return (
    <main className="mx-auto max-w-md p-6 mt-16">
      <Card>
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">
            Foi convidado para o condomínio <b>{convite.condominio.nome}</b>.
          </p>
          <form action={aceitar} className="space-y-4">
            <div className="space-y-2">
              <Label>Email (do convite)</Label>
              <Input value={convite.email} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                name="nome"
                required
                defaultValue={session?.nome}
                placeholder="Nome completo"
              />
            </div>
            <Button type="submit" className="w-full">
              Aceitar e entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
