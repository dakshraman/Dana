import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Building2, ChartNoAxesCombined, ShieldCheck } from "lucide-react"

import { LoginForm } from "@/components/auth/login-form"
import { getSessionUser } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign in",
}

function safeCallback(value: string | undefined): string {
  if (!value) return "/dashboard"
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"
  if (value.startsWith("/login")) return "/dashboard"
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")

  const params = await searchParams
  const callbackUrl = safeCallback(params.callbackUrl)

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.17_0.014_220)] text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.18) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden
          className="absolute -right-40 -bottom-40 size-[34rem] rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-primary text-base font-black tracking-tighter text-primary-foreground">
              D
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.28em] uppercase">
                Dana Company
              </p>
              <p className="text-[10px] tracking-[0.2em] text-white/45 uppercase">
                Operations Data Management
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl p-10">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-primary-foreground/70 uppercase">
            Multi-branch operations
          </p>
          <h2 className="mt-4 text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
            One operating picture.
            <br />
            Every branch. Every day.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">
            Record, review and report operational data across cities, countries
            and regions — with role-based access and a complete approval trail.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Building2, label: "Branch network" },
              { icon: ShieldCheck, label: "Role-based access" },
              { icon: ChartNoAxesCombined, label: "Audit-ready reports" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="border-l border-white/15 pl-3 text-[11px] tracking-wider text-white/60 uppercase"
              >
                <Icon className="mb-2 size-4 text-primary-foreground/80" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 p-10 text-[10px] tracking-[0.18em] text-white/35 uppercase">
          Internal use only · Authorized personnel
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12 sm:px-10">
        <LoginForm
          callbackUrl={callbackUrl}
          showDemoAccounts={process.env.NODE_ENV !== "production"}
        />
      </section>
    </div>
  )
}
