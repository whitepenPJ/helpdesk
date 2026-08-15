"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, deletePushSubscription } from "@/app/actions/notifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

type Status = "unsupported" | "checking" | "denied" | "subscribed" | "unsubscribed";

export function NotificationSubscribe() {
  const [status, setStatus] = useState<Status>("checking");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function determineStatus(): Promise<Status> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        return subscription ? "subscribed" : "unsubscribed";
      } catch {
        return "unsubscribed";
      }
    }

    determineStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setStatus("subscribed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setIsBusy(false);
    }
  }

  if (status === "unsupported" || status === "checking") return null;

  if (status === "denied") {
    return (
      <span className="dropdown-item disabled text-secondary">
        <i className="bi bi-bell-slash me-2" aria-hidden="true"></i>
        Notifications blocked in browser settings
      </span>
    );
  }

  if (status === "subscribed") {
    return (
      <button type="button" className="dropdown-item" onClick={handleUnsubscribe} disabled={isBusy}>
        <i className="bi bi-bell-fill me-2 text-success" aria-hidden="true"></i>
        {isBusy ? "Working…" : "Notifications enabled — turn off"}
      </button>
    );
  }

  return (
    <button type="button" className="dropdown-item" onClick={handleSubscribe} disabled={isBusy}>
      <i className="bi bi-bell me-2" aria-hidden="true"></i>
      {isBusy ? "Working…" : "Enable browser notifications"}
    </button>
  );
}
