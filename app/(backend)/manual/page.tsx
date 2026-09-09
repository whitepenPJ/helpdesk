import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { ROLE_LABEL } from "@/app/lib/roles";
import { audiencesForRole } from "@/app/lib/manual-access";
import { AUDIENCE_BLURB, AUDIENCE_LABEL, topicsForAudience } from "./manual-content";

export default async function ManualHomePage() {
  const session = await auth();
  const role = session?.user?.role ?? Role.USER;
  const audiences = audiencesForRole(role);

  return (
    <>
      <h2 className="fs-4 mb-1">User Manual</h2>
      <p className="text-secondary">
        Signed in as <span className="fw-semibold">{ROLE_LABEL[role]}</span>. The sections below are the parts of
        the manual available to your role.
      </p>

      {audiences.map((audience) => {
        const topics = topicsForAudience(audience);
        return (
          <section key={audience} className="mt-4">
            <h3 className="fs-5 border-bottom pb-2 mb-3">{AUDIENCE_LABEL[audience]}</h3>
            <p className="text-secondary">{AUDIENCE_BLURB[audience]}</p>
            <div className="row g-3">
              {topics.map((topic) => (
                <div key={topic.slug} className="col-md-6">
                  <Link
                    href={`/manual/${topic.audience}/${topic.slug}`}
                    className="card h-100 text-decoration-none link-body-emphasis"
                  >
                    <div className="card-body d-flex gap-3">
                      <i className={`bi ${topic.icon} fs-4 text-primary flex-shrink-0`} aria-hidden="true" />
                      <div>
                        <div className="fw-semibold">{topic.title}</div>
                        <div className="small text-secondary">{topic.summary}</div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
