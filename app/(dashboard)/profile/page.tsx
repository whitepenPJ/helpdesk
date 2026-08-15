import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { excerpt } from "@/app/lib/text";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireUser();

  const [user, companies, departments, lessonsLearned] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
    prisma.lessonLearned.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, description: true },
    }),
  ]);

  // A JWT session can outlive the User row it names (e.g. an admin deleted
  // the account mid-session) — the DB is the source of truth, not the token.
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Profile</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Profile
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12 col-lg-8">
              <ProfileForm
                email={user.email}
                role={user.role}
                companies={companies.map((c) => ({ value: c.id, label: c.name }))}
                departments={departments.map((d) => ({ value: d.id, label: d.name, companyId: d.companyId }))}
                initialValues={{
                  name: user.name,
                  telephone: user.telephone ?? "",
                  companyId: user.companyId ?? "",
                  departmentId: user.departmentId ?? "",
                }}
              />
            </div>
            <div className="col-12 col-lg-4">
              <div className="card card-outline mb-4">
                <div className="card-header">
                  <div className="card-title">Lesson Learned</div>
                </div>
                <div className="card-body p-0">
                  {lessonsLearned.length === 0 ? (
                    <p className="text-secondary p-3 mb-0">No lesson learned entries yet.</p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {lessonsLearned.map((entry) => (
                        <li key={entry.id} className="list-group-item">
                          <Link href={`/lesson-learned/${entry.id}`} className="text-decoration-none text-reset">
                            <div className="fw-medium">{entry.title}</div>
                            <div className="text-secondary fs-7">{excerpt(entry.description, 80)}</div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="card-footer text-center">
                  <Link href="/lesson-learned">View all →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
