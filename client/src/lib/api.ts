import type {
  RosterEvent,
  CreateEventRequest,
  EventWithSlots,
  InviteLink,
  PublicInviteData,
  CreateSlotRequest,
  UpdateSlotRequest,
  UpdateEventRequest,
  TimeSlotResponse,
  UserMeResponse,
  SignupManageData,
} from "@/lib/types"

const BASE = "/api"

export class ApiError extends Error {
  status: number
  code?: string
  fields?: Record<string, string[]>
  constructor(
    status: number,
    message: string,
    fields?: Record<string, string[]>,
    code?: string
  ) {
    super(message)
    this.status = status
    this.fields = fields
    this.code = code
  }
}

async function authHeaders(getToken: () => Promise<string | null>) {
  const token = await getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function parseErrorBody(body: unknown): {
  message: string
  fields?: Record<string, string[]>
  code?: string
} {
  if (!body || typeof body !== "object") return { message: "" }
  const b = body as Record<string, unknown>
  const fields =
    b.errors && typeof b.errors === "object"
      ? (b.errors as Record<string, string[]>)
      : undefined
  const message =
    (typeof b.title === "string" && b.title) ||
    (typeof b.error === "string" && b.error) ||
    (typeof b.detail === "string" && b.detail) ||
    ""
  const code = typeof b.code === "string" ? b.code : undefined
  return { message, fields, code }
}

async function checkJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const { message, fields, code } = parseErrorBody(body)
    throw new ApiError(res.status, message || res.statusText, fields, code)
  }
  return res.json()
}

async function checkVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const { message, fields, code } = parseErrorBody(body)
    throw new ApiError(res.status, message || res.statusText, fields, code)
  }
}

/** Flatten ApiError fields the same way everywhere (backend RFC 9457). */
export function formatApiError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.fields) {
    const messages = Object.entries(e.fields).flatMap(([field, msgs]) =>
      msgs.map((m) => `${field}: ${m}`)
    )
    if (messages.length > 0) return messages.join("\n")
    return e.message || fallback
  }
  return e instanceof Error ? e.message : fallback
}

export function createAdminApi(getToken: () => Promise<string | null>) {
  const h = () => authHeaders(getToken)

  return {
    getCurrentUser: async () => {
      const res = await fetch(`${BASE}/user/me`, { headers: await h() })
      return checkJson<UserMeResponse>(res)
    },

    createOrganization: async (name: string) => {
      const res = await fetch(`${BASE}/organizations`, {
        method: "POST",
        headers: await h(),
        body: JSON.stringify({ name }),
      })
      return checkJson<{ id: string; name: string; createdAt: string }>(res)
    },

    createEvent: async (orgId: string, data: CreateEventRequest) => {
      const res = await fetch(`${BASE}/organizations/${orgId}/events`, {
        method: "POST",
        headers: await h(),
        body: JSON.stringify(data),
      })
      return checkJson<{ id: string }>(res)
    },

    updateEvent: async (eventId: string, data: UpdateEventRequest) => {
      const res = await fetch(`${BASE}/events/${eventId}`, {
        method: "PUT",
        headers: await h(),
        body: JSON.stringify(data),
      })
      return checkJson<{ id: string }>(res)
    },

    getEvent: async (id: string) => {
      const res = await fetch(`${BASE}/events/${id}`, { headers: await h() })
      return checkJson<RosterEvent>(res)
    },

    deleteEvent: async (eventId: string) => {
      const res = await fetch(`${BASE}/events/${eventId}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },

    createSlot: async (eventId: string, data: CreateSlotRequest) => {
      const res = await fetch(`${BASE}/events/${eventId}/slots`, {
        method: "POST",
        headers: await h(),
        body: JSON.stringify(data),
      })
      return checkJson<TimeSlotResponse>(res)
    },

    updateSlot: async (
      eventId: string,
      slotId: string,
      data: UpdateSlotRequest
    ) => {
      const res = await fetch(`${BASE}/events/${eventId}/slots/${slotId}`, {
        method: "PUT",
        headers: await h(),
        body: JSON.stringify(data),
      })
      return checkJson<TimeSlotResponse>(res)
    },

    deleteSlot: async (eventId: string, slotId: string) => {
      const res = await fetch(`${BASE}/events/${eventId}/slots/${slotId}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },

    getRoster: async (orgId: string, weekStart: string) => {
      const res = await fetch(
        `${BASE}/organizations/${orgId}/roster?weekStart=${weekStart}`,
        {
          headers: await h(),
        }
      )
      return checkJson<RosterEvent[]>(res)
    },

    listEvents: async (orgId: string, from: string, to: string) => {
      const res = await fetch(
        `${BASE}/organizations/${orgId}/events?from=${from}&to=${to}`,
        {
          headers: await h(),
        }
      )
      return checkJson<EventWithSlots[]>(res)
    },

    deleteSignup: async (signupId: string) => {
      const res = await fetch(`${BASE}/signups/${signupId}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },

    createInviteLink: async (eventId: string) => {
      const res = await fetch(`${BASE}/events/${eventId}/invite-links`, {
        method: "POST",
        headers: await h(),
        body: JSON.stringify({}),
      })
      return checkJson<InviteLink>(res)
    },

    listInviteLinks: async (eventId: string) => {
      const res = await fetch(`${BASE}/events/${eventId}/invite-links`, {
        headers: await h(),
      })
      return checkJson<InviteLink[]>(res)
    },

    revokeInviteLink: async (id: string) => {
      const res = await fetch(`${BASE}/invite-links/${id}/revoke`, {
        method: "PUT",
        headers: await h(),
      })
      await checkVoid(res)
    },

    deleteOrganization: async (orgId: string) => {
      const res = await fetch(`${BASE}/organizations/${orgId}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },
  }
}

export type AdminApi = ReturnType<typeof createAdminApi>

export function createPublicApi() {
  return {
    getInvitePage: async (code: string) => {
      const res = await fetch(`${BASE}/invite/${code}`)
      return checkJson<PublicInviteData>(res)
    },

    createSignup: async (
      code: string,
      data: {
        slotId: string
        volunteerName: string
        email: string
        answers?: { questionId: string; value: string }[]
      }
    ) => {
      const res = await fetch(`${BASE}/invite/${code}/signups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      return checkJson<{
        id: string
        slotId: string
        volunteerName: string
        email: string
        createdAt: string
        status: string
        waitlistPosition: number | null
      }>(res)
    },

    resendSignup: async (
      code: string,
      data: { slotId: string; email: string }
    ) => {
      const res = await fetch(`${BASE}/invite/${code}/signups/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      await checkVoid(res)
    },

    getSignupDetails: async (token: string) => {
      const res = await fetch(`${BASE}/signup/manage/${token}`)
      return checkJson<SignupManageData>(res)
    },

    cancelSignup: async (token: string) => {
      const res = await fetch(`${BASE}/signup/manage/${token}/cancel`, {
        method: "POST",
      })
      await checkVoid(res)
    },
  }
}

export type PublicApi = ReturnType<typeof createPublicApi>
