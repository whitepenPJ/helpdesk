import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { audiencesForRole } from "@/app/lib/manual-access";
import { AUDIENCE_LABEL, MANUAL_TOPICS, findTopic } from "../../manual-content";
import { ManualBlocks } from "../../_components/manual-blocks";

type Params = { audience: string; slug: string };

export function generateStaticParams(): Params[] {
  return MANUAL_TOPICS.map((t) => ({ audience: t.audience, slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { audience, slug } = await params;
  const topic = findTopic(audience, slug);
  return { title: topic ? `${topic.title} · User Manual` : "User Manual" };
}

export default async function ManualTopicPage({ params }: { params: Promise<Params> }) {
  const { audience, slug } = await params;
  const topic = findTopic(audience, slug);
  if (!topic) notFound();

  // Real access boundary, re-checked server-side — not just a hidden nav link.
  const session = await auth();
  const role = session?.user?.role ?? Role.USER;
  if (!audiencesForRole(role).includes(topic.audience)) notFound();

  return (
    <article className="manual-topic">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/manual">Manual</Link>
          </li>
          <li className="breadcrumb-item">{AUDIENCE_LABEL[topic.audience]}</li>
          <li className="breadcrumb-item active" aria-current="page">
            {topic.title}
          </li>
        </ol>
      </nav>

      <h2 className="fs-4 d-flex align-items-center gap-2">
        <i className={`bi ${topic.icon} text-primary`} aria-hidden="true" />
        {topic.title}
      </h2>
      <p className="text-secondary">{topic.summary}</p>

      {topic.sections.map((section, i) => (
        <section key={i} className="mt-4">
          <h3 className="fs-5 border-bottom pb-2 mb-3">{section.heading}</h3>
          <ManualBlocks blocks={section.blocks} />
        </section>
      ))}
    </article>
  );
}
