"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: number;
  client_id: number | null;
  event_type: string;
  title: string;
  message?: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

function websocketUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  return `${base.replace(/^http/, "ws")}/ws/notifications`;
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationItem[]>("/notifications")).data,
    refetchInterval: 60000,
  });

  const notifications = data ?? [];
  const unread = notifications.filter((notification) => !notification.is_read).length;

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(websocketUrl());
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          toast.message(payload.title || "Notification", { description: payload.message || undefined });
        } catch {
          // ignore malformed realtime payload
        }
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      };
    } catch {
      // realtime channel unavailable, the 60s poll above keeps the badge current
    }
    return () => socket?.close();
  }, [queryClient]);

  async function markRead(id: number) {
    await api.patch(`/notifications/${id}/read`).catch(() => null);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function remove(id: number) {
    await api.delete(`/notifications/${id}`).catch(() => null);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface2 text-ink2 shadow-card transition hover:border-brand-400 hover:text-brand-300"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-slide-down overflow-hidden rounded-xl border border-line bg-surface shadow-popover">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-bold text-ink">Notifications</span>
            {unread > 0 && <span className="text-xs font-semibold text-brand-300">{unread} non lues</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-ink3">
                <Loader2 size={14} className="animate-spin" /> Chargement...
              </div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="p-6 text-center text-sm text-ink3">Aucune notification pour le moment.</div>
            )}
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-2 border-b border-line/70 px-3 py-2.5 text-sm last:border-0",
                  !notification.is_read && "bg-brand-500/5",
                )}
              >
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", notification.is_read ? "bg-surface3" : "bg-brand-400")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{notification.title}</p>
                  {notification.message && <p className="mt-0.5 line-clamp-2 text-xs text-ink3">{notification.message}</p>}
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink3">{timeAgo(notification.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!notification.is_read && (
                    <button
                      onClick={() => markRead(notification.id)}
                      className="rounded-md p-1 text-ink3 hover:bg-surface3 hover:text-brand-300"
                      title="Marquer comme lu"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button onClick={() => remove(notification.id)} className="rounded-md p-1 text-ink3 hover:bg-rose-500/10 hover:text-rose-400" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
