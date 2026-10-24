import { compare } from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import type { AppRole } from "@/lib/permissions"
import { loginSchema } from "@/lib/validations/auth"

// Used to keep the timing of a failed login similar whether or not the email
// exists. This is a real bcrypt hash of an unguessable random string.
const DUMMY_HASH =
  "$2b$12$Lby5n4v6jDbNu4V2Fn5oAuaG3oKDKj/fYkxqLapRODHmlSw2QCp1e"

const MAX_FAILED_ATTEMPTS = 10
const FAILURE_WINDOW_MS = 15 * 60 * 1000

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const email = parsed.data.email.toLowerCase().trim()
        const password = parsed.data.password

        try {
          const failedAttempts = await prisma.loginAttempt.count({
            where: {
              email,
              success: false,
              createdAt: { gte: new Date(Date.now() - FAILURE_WINDOW_MS) },
            },
          })

          if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            await writeAudit({
              actorId: null,
              action: "LOGIN_FAILED",
              entityType: "User",
              summary: `Login blocked by rate limit for ${email}`,
              metadata: { email, reason: "rate_limited" },
            })
            return null
          }

          const user = await prisma.user.findUnique({ where: { email } })
          const passwordOk = await compare(password, user?.passwordHash ?? DUMMY_HASH)

          await prisma.loginAttempt.create({
            data: { email, success: Boolean(user && passwordOk && user.isActive) },
          })

          if (!user || !passwordOk || !user.isActive) {
            await writeAudit({
              actorId: user?.id ?? null,
              action: "LOGIN_FAILED",
              entityType: "User",
              entityId: user?.id,
              summary: `Failed login attempt for ${email}`,
              metadata: { email },
            })
            return null
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })

          await writeAudit({
            actorId: user.id,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
            summary: `${user.name} signed in`,
          })

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as AppRole,
          }
        } catch (error) {
          console.error("[auth] authorize failed", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string | undefined) ?? ""
        session.user.role = (token.role as AppRole | undefined) ?? "BRANCH_EMPLOYEE"
      }
      return session
    },
  },
})
