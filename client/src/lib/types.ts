import type { components } from "@/lib/generated/schema"

type Schemas = components["schemas"]

type Num<T> = null extends T
  ? number extends Exclude<T, null>
    ? number | null
    : T
  : number extends T
    ? number
    : T

type NumericFields<T> = {
  [K in keyof T]: T[K] extends Array<infer U>
    ? Array<NumericFields<U>>
    : T[K] extends object
      ? NumericFields<T[K]>
      : Num<T[K]>
}

export type RosterEvent = NumericFields<Schemas["RosterEventResponse"]>

export type RosterSlot = NumericFields<Schemas["RosterSlotResponse"]>

export type SignupInfo = Schemas["SignupResponse"]

export type InviteLink = Schemas["InviteLinkResponse"]

export type CreateEventRequest = NumericFields<Schemas["CreateEventRequest"]>

export type CreateRecurringEventsRequest = NumericFields<
  Schemas["CreateRecurringEventsRequest"]
>

export type RecurrenceRequest = NumericFields<Schemas["RecurrenceRequest"]>

export type RecurrenceFrequency = Schemas["RecurrenceFrequency"]

export type CreateGroupRequest = NumericFields<Schemas["CreateGroupRequest"]>

export type UpdateGroupRequest = NumericFields<Schemas["UpdateGroupRequest"]>

export type Group = NumericFields<Schemas["GroupResponse"]>

export type GroupAdmin = NumericFields<Schemas["GroupAdminResponse"]>

export type GroupAdminRole = Schemas["GroupAdminRole"]

export type GroupDetail = NumericFields<Schemas["GroupDetailResponse"]>

export type AddGroupAdminRequest = NumericFields<Schemas["AddGroupAdminRequest"]>

export type CreateSlotRequest = NumericFields<Schemas["CreateSlotRequest"]>

export type PublicInviteData = NumericFields<Schemas["InvitePageResponse"]>

export type PublicEvent = NumericFields<Schemas["EventPublicResponse"]>

export type PublicSlot = NumericFields<Schemas["SlotAvailabilityResponse"]>

export type SignupManageData = NumericFields<Schemas["SignupManageResponse"]>

export type RosterQuestion = NumericFields<Schemas["RosterQuestionResponse"]>

export type SignupAnswer = Schemas["SignupAnswerResponse"]

export type PublicQuestion = NumericFields<Schemas["PublicQuestionResponse"]>

export type QuestionType = NonNullable<Schemas["QuestionType"]>

export type RemovalEmailPolicy = Schemas["RemovalEmailPolicy"]

export type UpdateSlotRequest = NumericFields<Schemas["UpdateSlotRequest"]>

export type UpdateEventRequest = NumericFields<Schemas["UpdateEventRequest"]>

export type EventSlotUpsert = NumericFields<Schemas["EventSlotUpsert"]>

export type TimeSlotResponse = NumericFields<Schemas["TimeSlotResponse"]>

export type EventWithSlots = NumericFields<
  Schemas["EventWithSlotsResponse"]
>

export type EventActivity = Schemas["EventActivityResponse"]

export type EventActivityList = NumericFields<
  Schemas["EventActivityListResponse"]
>

export type ReportsData = NumericFields<Schemas["ReportsResponse"]>

export type ReportsSummary = NumericFields<Schemas["ReportsSummaryResponse"]>

export type ReportGroupRow = NumericFields<Schemas["ReportGroupRow"]>

export type ReportEventRow = NumericFields<Schemas["ReportEventRow"]>

export type ReportDayCount = NumericFields<Schemas["DayCount"]>

export type EventSlotSummary = NumericFields<Schemas["TimeSlotResponse"]>
