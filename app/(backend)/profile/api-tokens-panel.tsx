"use client";

import { useActionState, useState } from "react";
import { createApiToken, deleteApiToken, type CreateApiTokenState } from "@/app/actions/api-tokens";
import { DeleteButton } from "../_components/delete-button";
import { formatDateTime } from "@/app/lib/date-format";

type Token = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null };

export function ApiTokensPanel({ tokens }: { tokens: Token[] }) {
  const [state, formAction, pending] = useActionState<CreateApiTokenState, FormData>(createApiToken, undefined);
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!state?.token) return;
    try {
      await navigator.clipboard.writeText(state.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the token is
      // still visible and selectable in the input below.
    }
  }

  return (
    <div className="card card-outline mb-4">
      <div className="card-header">
        <div className="card-title">API Tokens</div>
      </div>
      <div className="card-body">
        <p className="text-secondary fs-7">
          Used to authenticate external tools (like an MCP client) as you — there&apos;s no browser session for those
          to read.
        </p>

        {state?.token && (
          <div className="alert alert-success">
            <div className="fw-medium mb-1">Token created — copy it now, it won&apos;t be shown again.</div>
            <div className="input-group input-group-sm">
              <input type="text" className="form-control font-monospace" value={state.token} readOnly />
              <button type="button" className="btn btn-outline-secondary" onClick={copyToken}>
                <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"} me-1`} aria-hidden="true"></i>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <form action={formAction} className="d-flex gap-2 mb-3" key={state?.token ?? "form"}>
          <label htmlFor="token-name" className="visually-hidden">
            Token name
          </label>
          <input
            id="token-name"
            type="text"
            name="name"
            className="form-control form-control-sm"
            placeholder="e.g. Gemini MCP, Microsoft Copilot MCP, Claude MCP"
            required
          />
          <button type="submit" className="btn btn-sm btn-primary text-nowrap" disabled={pending}>
            <i className="bi bi-key-fill me-1" aria-hidden="true"></i>
            {pending ? "Generating…" : "Generate token"}
          </button>
        </form>
        {state?.errors?.name && <div className="text-danger small mb-3 mt-n2">{state.errors.name[0]}</div>}

        {tokens.length === 0 ? (
          <p className="text-secondary mb-0">No tokens yet.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {tokens.map((t) => (
              <li key={t.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                <div>
                  <div className="fw-medium">{t.name}</div>
                  <div className="text-secondary fs-7">
                    Created {formatDateTime(t.createdAt)}
                    {t.lastUsedAt ? ` · Last used ${formatDateTime(t.lastUsedAt)}` : " · Never used"}
                  </div>
                </div>
                <DeleteButton
                  action={deleteApiToken.bind(null, t.id)}
                  confirmMessage={`Revoke the "${t.name}" token? Any client using it will stop working immediately.`}
                  label={`Revoke ${t.name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
