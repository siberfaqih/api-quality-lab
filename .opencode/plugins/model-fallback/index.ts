import { Plugin } from "@opencode/plugin"

type Route = { primary: string; fallback: string }
type Options = { routes?: Record<string, Route> }

const DEFAULT_ROUTES: Record<string, Route> = {
  builder: {
    primary: "opencode/deepseek-v4.1-flash-free",
    fallback: "meta/muse-spark-1.3-contributor",
  },
  reviewer: {
    primary: "openai/gpt-6.1-sol",
    fallback: "meta/muse-wonder-1.0",
  },
}

function splitRef(ref: string): { providerID: string; id: string } | undefined {
  const slash = ref.indexOf("/")
  if (slash <= 0 || slash === ref.length - 1) return undefined
  // Strip any #variant suffix; this plugin always uses the provider default variant.
  const hash = ref.indexOf("#")
  const clean = hash >= 0 ? ref.slice(0, hash) : ref
  const s = clean.indexOf("/")
  if (s <= 0 || s === clean.length - 1) return undefined
  return { providerID: clean.slice(0, s), id: clean.slice(s + 1) }
}

export default Plugin.define({
  id: "aql-model-fallback",
  async setup(ctx) {
    const opts = (ctx.options ?? {}) as Options
    const routes: Record<string, Route> = { ...DEFAULT_ROUTES, ...(opts.routes ?? {}) }

    await ctx.session.hook("retry", async (event) => {
      const route = routes[event.agent]
      if (!route) return

      const current = `${event.model.providerID}/${event.model.id}`
      if (current !== route.primary) return

      const key = `aql-fallback:${event.sessionID}`
      const already = await ctx.storage.get(key)
      if (already) return

      const target = splitRef(route.fallback)
      if (!target) return

      try {
        await ctx.session.switchModel({
          sessionID: event.sessionID,
          model: { providerID: target.providerID, id: target.id },
        })
        await ctx.storage.set(key, {
          agent: event.agent,
          from: current,
          to: route.fallback,
          errorType: event.error.type,
          errorStatus: event.error.status ?? null,
          attempt: event.attempt,
        })
        // Ensure the retry is attempted with the fallback model when the
        // built-in policy would otherwise stop retrying.
        if (!event.decision.retry) {
          event.decision = { retry: true, delay: 0 }
        }
      } catch {
        // Never break the session loop if the fallback switch fails.
        // Leave the original retry decision untouched.
      }
    })
  },
})
