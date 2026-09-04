import type { Metadata } from "next";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../_components/page-header";
import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "New Company" };

export default async function NewCompanyPage() {
  const session = await requireAdmin();

  return (
    <>
      <PageHeader title="New Company" role={session.user.role} breadcrumbs={[{ label: "Companies", href: "/master/company" }, { label: "New" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <CompanyForm mode="create" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
