"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 20000;

// Two-tone chime via the Web Audio API — no audio asset to ship, and it
// only ever runs in response to the poll below (never on page load), so it
// doesn't fight the browser's autoplay-without-a-gesture restrictions.
function playChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [880, 1108.73].forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.35);
    });

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Autoplay/permission errors are fine to swallow — the visual badge
    // (via router.refresh()) still updates either way.
  }
}

// Polls the unread-notification count and, when it rises above what we last
// saw, plays an alert chime and refreshes the page so the header bell badge
// and any open list pick up the new ticket. Not true push/SSE realtime —
// there's no websocket layer in this app — but keeps admins within ~20s of
// a new ticket without requiring a manual refresh.
export function NotificationPoller({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const lastCount = useRef(initialUnreadCount);

  useEffect(() => {
    lastCount.current = initialUnreadCount;
  }, [initialUnreadCount]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        if (!res.ok) return;
        const { count } = (await res.json()) as { count: number };
        if (count > lastCount.current) {
          playChime();
          router.refresh();
        }
        lastCount.current = count;
      } catch {
        // Network hiccup — just try again on the next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
