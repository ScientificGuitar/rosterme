import type {
  RosterEvent,
  CreateEventRequest,
  EventWithSlots,
  Group,
  InviteLink,
  PublicInviteData,
  CreateSlotRequest,
  UpdateSlotRequest,
  UpdateEventRequest,
  TimeSlotResponse,
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
    getGroups: async () => {
      const res = await fetch(`${BASE}/groups`, { headers: await h() })
      return checkJson<Group[]>(res)
    },

    createGroup: async (name: string) => {
      const res = await fetch(`${BASE}/groups`, {
        method: "POST",
        headers: await h(),
        body: JSON.stringify({ name }),
      })
      return checkJson<Group>(res)
    },

    updateGroup: async (groupId: string, name: string) => {
      const res = await fetch(`${BASE}/groups/${groupId}`, {
        method: "PUT",
        headers: await h(),
        body: JSON.stringify({ name }),
      })
      return checkJson<Group>(res)
    },

    createEvent: async (data: CreateEventRequest) => {
      const res = await fetch(`${BASE}/events`, {
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

    getRoster: async (weekStart: string) => {
      const res = await fetch(`${BASE}/roster?weekStart=${weekStart}`, {
        headers: await h(),
      })
      return checkJson<RosterEvent[]>(res)
    },

    listEvents: async (from: string, to: string) => {
      const res = await fetch(`${BASE}/events?from=${from}&to=${to}`, {
        headers: await h(),
      })
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

    deleteGroup: async (groupId: string) => {
      const res = await fetch(`${BASE}/groups/${groupId}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },

    getSuperAdminStats: async () => {
      const res = await fetch(`${BASE}/superadmin/stats`, { headers: await h() })
      return checkJson<SuperAdminStats>(res)
    },

    getSuperAdminActivity: async (days = 30) => {
      const res = await fetch(`${BASE}/superadmin/activity?days=${days}`, {
        headers: await h(),
      })
      return checkJson<SuperAdminActivity>(res)
    },

    getSuperAdminRecent: async (take = 10) => {
      const res = await fetch(`${BASE}/superadmin/recent?take=${take}`, {
        headers: await h(),
      })
      return checkJson<SuperAdminRecent>(res)
    },

    listOutbox: async (params?: { sent?: boolean; skip?: number; take?: number }) => {
      const search = new URLSearchParams()
      if (params?.sent !== undefined) search.set("sent", String(params.sent))
      if (params?.skip !== undefined) search.set("skip", String(params.skip))
      if (params?.take !== undefined) search.set("take", String(params.take))
      const qs = search.toString() ? `?${search}` : ""
      const res = await fetch(`${BASE}/superadmin/outbox${qs}`, {
        headers: await h(),
      })
      return checkJson<SuperAdminOutboxList>(res)
    },

    deleteOutboxMessage: async (id: string) => {
      const res = await fetch(`${BASE}/superadmin/outbox/${id}`, {
        method: "DELETE",
        headers: await h(),
      })
      await checkVoid(res)
    },
  }
}

export interface SuperAdminStats {
  groups: number
  events: number
  slots: number
  signups: number
  inviteLinks: number
  owners: number
  emailsPending: number
  emailsSent: number
  capacityFillRate: number
  signupsByStatus: Record<string, number>
}

export interface DayCount {
  date: string
  count: number
}

export interface SuperAdminActivity {
  signupsPerDay: DayCount[]
  eventsPerDay: DayCount[]
}

export interface SuperAdminRecent {
  groups: { id: string; name: string; groupOwner: string; createdAt: string }[]
  events: { id: string; groupId: string; title: string; date: string; createdAt: string }[]
  signups: {
    id: string
    timeSlotId: string
    volunteerName: string
    email: string
    status: string
    createdAt: string
  }[]
}

export interface SuperAdminOutboxRow {
  id: string
  to: string
  subject: string
  sent: boolean
  createdAt: string
  sentAt: string | null
}

export interface SuperAdminOutboxList {
  total: number
  skip: number
  take: number
  items: SuperAdminOutboxRow[]
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

    confirmSignup: async (token: string) => {
      const res = await fetch(`${BASE}/signup/manage/${token}/confirm`, {
        method: "POST",
      })
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
