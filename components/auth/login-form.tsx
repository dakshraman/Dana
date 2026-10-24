"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "superadmin@dana.com" },
  { label: "Regional Manager", email: "regional.na@dana.com" },
  { label: "Branch Manager", email: "branch.manager@dana.com" },
  { label: "Branch Employee", email: "employee@dana.com" },
]

export function LoginForm({
  callbackUrl,
  showDemoAccounts,
}: {
  callbackUrl: string
  showDemoAccounts: boolean
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setFormError(null)

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (!result || result.error) {
        setFormError(
          "Sign-in failed. Check your email and password, then try again."
        )
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch {
      setFormError("Unable to sign in right now. Please try again.")
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-[0.25em] text-primary uppercase">
          Dana Company
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your company account to access branch operations data.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        {formError && (
          <div
            role="alert"
            className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[11px] tracking-wider uppercase">
            Email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@dana.com"
              className="pl-6"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="text-[11px] tracking-wider uppercase"
          >
            Password
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="px-6"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {showDemoAccounts && (
        <div className="mt-10 border-t pt-6">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Development sample accounts
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose an account, then enter the password you set as{" "}
            <code className="bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              SEED_PASSWORD
            </code>
            .
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="xs"
                className="justify-start normal-case tracking-normal"
                onClick={() => {
                  setValue("email", account.email, { shouldValidate: true })
                }}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
