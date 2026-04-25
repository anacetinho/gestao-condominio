import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function CriarCondominioPage() {
  const session = await requireSession();

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const nome = String(formData.get("nome") ?? "").trim();
    const morada = String(formData.get("morada") ?? "").trim();
    const nif = String(formData.get("nif") ?? "").trim() || null;
    if (!nome || !morada) throw new Error("Nome e morada são obrigatórios");

    const condominio = await prisma.condominio.create({
      data: {
        nome,
        morada,
        nif,
        memberships: {
          create: {
            userId: s.userId,
            role: Role.ADMINISTRADOR,
          },
        },
      },
    });
    await recordAudit({
      condominioId: condominio.id,
      action: AuditAction.CONDOMINIO_CRIADO,
      payload: { nome, morada },
    });
    redirect(`/${condominio.id}/dashboard`);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Criar condomínio</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={criar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" required placeholder="Ex: Condomínio Alameda 12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="morada">Morada</Label>
              <Input id="morada" name="morada" required placeholder="Rua, número, código-postal" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF (opcional)</Label>
              <Input id="nif" name="nif" inputMode="numeric" />
            </div>
            <p className="text-xs text-muted-foreground">
              {session.nome} — será o primeiro administrador.
            </p>
            <Button type="submit" className="w-full">
              Criar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
