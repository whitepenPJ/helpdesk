"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} noValidate>
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <label className="visually-hidden" htmlFor="loginEmail">
        Email
      </label>
      <div className="input-group mb-3">
        <input
          id="loginEmail"
          name="email"
          type="email"
          className="form-control"
          placeholder="Email"
          defaultValue={state?.email ?? ""}
          aria-describedby={state?.errors?.email ? "loginEmail-error" : undefined}
        />
        <div className="input-group-text">
          <span className="bi bi-envelope"></span>
        </div>
      </div>
      {state?.errors?.email && (
        <div id="loginEmail-error" className="text-danger small mb-3 mt-n2">
          {state.errors.email[0]}
        </div>
      )}

      <label className="visually-hidden" htmlFor="loginPassword">
        Password
      </label>
      <div className="input-group mb-3">
        <input
          id="loginPassword"
          name="password"
          type={showPassword ? "text" : "password"}
          className="form-control"
          placeholder="Password"
          aria-describedby={state?.errors?.password ? "loginPassword-error" : undefined}
        />
        <button
          type="button"
          className="input-group-text"
          onClick={() => setShowPassword((show) => !show)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          <span className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></span>
        </button>
      </div>
      {state?.errors?.password && (
        <div id="loginPassword-error" className="text-danger small mb-3 mt-n2">
          {state.errors.password[0]}
        </div>
      )}

      {state?.formError && (
        <div className="alert alert-danger py-2" role="alert">
          {state.formError}
        </div>
      )}

      <div className="row">
        <div className="col-12">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="rememberMe"
              name="remember"
              defaultChecked={state?.remember ?? false}
            />
            <label className="form-check-label" htmlFor="rememberMe">
              Remember Me
            </label>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={pending}>
              <span className="bi bi-box-arrow-in-right me-1"></span>
              {pending ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </form>
  );
}
