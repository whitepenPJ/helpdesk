import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteCompany } from "@/app/actions/companies";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import { ErrorAlert } from "../../_components/error-alert";
import type { SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";
import { fetchPage } from "@/app/lib/list-query";
import { parseListParams } from "@/app/lib/list-params";

export const metadata: Metadata = { title: "Companies" };

const PATHNAME = "/master/company";

const SORT_COLUMNS = ["name", "code", "address", "taxId", "isActive", "departments", "users", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const COLUMNS: ListColumn[] = [
  { label: "Company", sort: "name" },
  { label: "Code", sort: "code" },
  { label: "Address", sort: "address" },
  { label: "Tax ID", sort: "taxId" },
  { label: "Status", sort: "isActive" },
  { label: "Departments", sort: "departments" },
  { label: "Users", sort: "users" },
  { label: "Actions", className: "text-end" },
];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.CompanyOrderByWithRelationInput {
  switch (sortBy) {
    case "departments":
      return { Department: { _count: sortDir } };
    case "users":
      return { User: { _count: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "company-in-use": "This company still has users, departments, or tickets — remove those first.",
};

export default async function CompaniesPage({ searchParams }: PageProps<"/master/company">) {
  const session = await requireAdmin();

  const params = await searchParams;
  const { query, currentPage, pageSize, sortBy, sortDir, linkQuery } = parseListParams(params, SORT_COLUMNS, {
    column: "createdAt",
    dir: "desc",
  });
  const errorMessage = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;

  const where: Prisma.CompanyWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const { items: companies, total } = await fetchPage(
    () =>
      prisma.company.findMany({
        where,
        include: { _count: { select: { User: true, Department: true } } },
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    () => prisma.company.count({ where })
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader title="Companies" role={session.user.role} breadcrumbs={[{ label: "Master" }, { label: "Companies" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <ErrorAlert message={errorMessage} />

          <div className="row">
            <div className="col-12">
              <ListCard
                pathname={PATHNAME}
                query={query}
                linkQuery={linkQuery}
                searchPlaceholder="Search companies"
                newHref={`${PATHNAME}/new`}
                columns={COLUMNS}
                sortBy={sortBy}
                sortDir={sortDir}
                itemCount={companies.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
              >
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td className="fw-medium">{company.name}</td>
                    <td>{company.code ?? <span className="text-secondary">—</span>}</td>
                    <td>{company.address ?? <span className="text-secondary">—</span>}</td>
                    <td>{company.taxId ?? <span className="text-secondary">—</span>}</td>
                    <td>
                      <span className={`badge ${company.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                        {company.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>{company._count.Department}</td>
                    <td>{company._count.User}</td>
                    <td className="text-end">
                      <RowActions
                        basePath={PATHNAME}
                        id={company.id}
                        name={company.name}
                        deleteAction={deleteCompany.bind(null, company.id)}
                        confirmMessage={`Delete company "${company.name}"? This cannot be undone.`}
                      />
                    </td>
                  </tr>
                ))}
              </ListCard>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
