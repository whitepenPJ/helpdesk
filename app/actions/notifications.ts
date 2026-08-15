"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { markNotificationsSeen as markNotificationsSeenForUser } from "@/app/lib/notifications";

export async function markNotificationsSeen(): Promise<void> {
  const session = await requireUser();
  await markNotificationsSeenForUser(session.user.id);
}

export async function savePushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ error?: string }> {
  const session = await requireUser();

  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { error: "Invalid subscription." };
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      id: randomUUID(),
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    // A previously-registered endpoint may now belong to a different signed-in
    // user on the same browser — re-owning it keeps the row unique on endpoint.
    update: {
      userId: session.user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return {};
}

export async function deletePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const session = await requireUser();

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });

  return {};
}
