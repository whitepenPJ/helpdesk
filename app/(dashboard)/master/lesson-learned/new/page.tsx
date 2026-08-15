import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/app/lib/dal";
import { LessonLearnedForm } from "../lesson-learned-form";

export const metadata: Metadata = { title: "New Lesson Learned" };

export default async function NewLessonLearnedPage() {
  await requireAdmin();

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">New Lesson Learned</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/lesson-learned">Lesson Learned</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    New
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
            <div className="col-12">
              <LessonLearnedForm mode="create" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
