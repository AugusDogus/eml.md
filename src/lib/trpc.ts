import type { AnyRouter } from '@trpc/server'

// tRPC is intentionally type-only for now: this app is an offline SPA with no
// HTTP backend or server runtime.
export type OfflineTRPCRouter = AnyRouter
