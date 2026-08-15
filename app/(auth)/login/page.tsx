import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { loginWithMicrosoft } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const callbackUrlValue = typeof callbackUrl === "string" ? callbackUrl : undefined;

  return (
    <main className="login-box">
      <h1 className="login-logo">
        <Link href="/">
          <b>Help</b>desk
        </Link>
      </h1>

      <div className="card">
        <div className="card-body login-card-body">
          <p className="login-box-msg">Sign in</p>

          <LoginForm callbackUrl={callbackUrlValue} />

          <div className="social-auth-links text-center mb-3 d-grid gap-2">
            <p>- OR -</p>
            <form action={loginWithMicrosoft}>
              {callbackUrlValue && <input type="hidden" name="callbackUrl" value={callbackUrlValue} />}
              <button
                type="submit"
                className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #8c8c8c",
                  color: "#5e5e5e",
                  fontWeight: 600,
                }}
              >
                <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Sign in with Microsoft
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
