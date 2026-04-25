import { createHash, randomBytes } from "node:crypto";
import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function criarConvite(params: {
  condominioId: string;
  email: string;
  fracaoId?: string | null;
  role?: Role;
  appUrl: string;
}) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const convite = await prisma.convite.create({
    data: {
      condominioId: params.condominioId,
      email: params.email,
      fracaoId: params.fracaoId,
      role: params.role ?? Role.MORADOR,
      tokenHash: hash,
      expiresAt,
    },
  });

  const link = `${params.appUrl}/accept-invite/${raw}`;
  await sendEmail({
    to: params.email,
    subject: "Convite — Administração de Condomínio",
    html: `
      <p>Olá,</p>
      <p>Foi convidado para participar na gestão do condomínio.</p>
      <p>Aceite o convite em: <a href="${link}">${link}</a></p>
      <p>O convite é válido por 14 dias.</p>
    `,
    text: `Aceite o convite em: ${link}`,
  });

  return { convite, link };
}

export async function consumirConvite(
  rawToken: string,
  params: {
    email: string;
    nome: string;
  },
) {
  const hash = hashToken(rawToken);
  const convite = await prisma.convite.findUnique({ where: { tokenHash: hash } });
  if (!convite) throw new Error("Convite inválido");
  if (convite.acceptedAt) throw new Error("Convite já foi usado");
  if (convite.expiresAt < new Date()) throw new Error("Convite expirado");
  if (convite.email.toLowerCase() !== params.email.toLowerCase()) {
    throw new Error("Email não coincide com o do convite");
  }

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: params.email } });
    if (!user) {
      user = await tx.user.create({
        data: { email: params.email, nome: params.nome },
      });
    }
    const membership = await tx.membership.upsert({
      where: {
        condominioId_userId: {
          condominioId: convite.condominioId,
          userId: user.id,
        },
      },
      update: { role: convite.role, fracaoId: convite.fracaoId, leftAt: null },
      create: {
        condominioId: convite.condominioId,
        userId: user.id,
        role: convite.role,
        fracaoId: convite.fracaoId,
      },
    });
    await tx.convite.update({
      where: { id: convite.id },
      data: { acceptedAt: new Date() },
    });
    return { user, membership };
  });
}
