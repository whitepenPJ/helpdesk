import type { Metadata } from "next";
import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { audiencesForRole } from "@/app/lib/manual-access";
import { PageHeader } from "../_components/page-header";
import { topicsForAudience } from "./manual-content";
import { ManualNav } from "./_components/manual-nav";

export const metadata: Metadata = { title: "User Manual" };

export default async function ManualLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role ?? Role.USER;
  const groups = audiencesForRole(role).map((audience) => ({
    audience,
    topics: topicsForAudience(audience),
  }));

  return (
    <>
      <PageHeader title="User Manual" role={role} breadcrumbs={[{ label: "User Manual" }]} />
      <div className="app-content">
        <div className="container-fluid">
          <div className="row g-4">
            <aside className="col-lg-3">
              <div className="position-lg-sticky" style={{ top: "1rem" }}>
                <ManualNav groups={groups} />
              </div>
            </aside>
            <div className="col-lg-9">
              <div className="card">
                <div className="card-body manual-content">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
