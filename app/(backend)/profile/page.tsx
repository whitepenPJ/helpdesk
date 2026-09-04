import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { excerpt } from "@/app/lib/text";
import { ROLE_LABEL } from "@/app/lib/roles";
import { ProfileForm } from "./profile-form";
import { ApiTokensPanel } from "./api-tokens-panel";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireUser();

  const [user, lessonsLearned, apiTokens] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Company: { select: { name: true } }, Department_User_departmentIdToDepartment: { select: { name: true } } },
    }),
    prisma.lessonLearned.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, description: true, images: true },
    }),
    prisma.apiToken.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  // A JWT session can outlive the User row it names (e.g. an admin deleted
  // the account mid-session) — the DB is the source of truth, not the token.
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader title="Profile" role={session.user.role} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <ProfileForm
                email={user.email}
                role={ROLE_LABEL[user.role]}
                hasPassword={Boolean(user.passwordHash)}
                companyName={user.Company?.name ?? null}
                departmentName={user.Department_User_departmentIdToDepartment?.name ?? null}
                initialValues={{
                  name: user.name,
                  telephone: user.telephone ?? "",
                }}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <ApiTokensPanel tokens={apiTokens} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
