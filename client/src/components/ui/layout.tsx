import * as React from "react"
import { Plus, Search, X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Shared styled components — the app's design-system primitives.
 *
 * Prefer these over hand-rolling Tailwind class strings. Visual output is
 * identical to the documented patterns in `docs/DESIGN_GUIDELINES.md`;
 * the class strings live here once so pages stay declarative.
 *
 * - Width/spacing tokens also live in `@layer components` (index.css);
 *   per-instance tweaks still go through `className`.
 */

// ---------------------------------------------------------------------------
// Page shell (§1)
// ---------------------------------------------------------------------------

function AdminPageShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-page-shell"
      className={cn(
        "-mx-4 -mt-4 -mb-4 flex min-h-full flex-col md:-mx-6 md:-mt-6 md:-mb-6 md:min-h-[100svh]",
        className
      )}
      {...props}
    />
  )
}

function AdminPageBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-page-body"
      className={cn("min-w-0 flex-1 p-4 md:p-6", className)}
      {...props}
    />
  )
}

function AdminPageCenter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-page-center"
      className={cn("mx-auto w-full max-w-5xl space-y-4", className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Page header (§2)
// ---------------------------------------------------------------------------

function AdminHeaderBand({
  className,
  withTabs = false,
  ...props
}: React.ComponentProps<"div"> & { withTabs?: boolean }) {
  return (
    <div
      data-slot="admin-header-band"
      className={cn(
        "bg-green-50 px-4 pt-4 md:px-6 md:pt-6 dark:bg-green-950",
        withTabs ? "pb-0" : "pb-4 md:pb-6",
        className
      )}
      {...props}
    />
  )
}

function AdminHeaderTitleRow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-header-title-row"
      className={cn(
        "mt-1 flex flex-wrap items-start justify-between gap-4",
        className
      )}
      {...props}
    />
  )
}

function AdminHeaderTitleBlock({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-header-title-block"
      className={cn("min-w-0 flex-1", className)}
      {...props}
    />
  )
}

function AdminHeaderEyebrow({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="admin-header-eyebrow"
      className={cn("muted-xs", className)}
      {...props}
    />
  )
}

function AdminHeaderTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="admin-header-title"
      className={cn("page-title text-3xl break-words", className)}
      {...props}
    />
  )
}

function AdminHeaderSubtitle({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="admin-header-subtitle"
      className={cn("muted mt-1 truncate", className)}
      {...props}
    />
  )
}

function AdminHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  withTabs = false,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  withTabs?: boolean
  className?: string
}) {
  return (
    <div data-slot="admin-header">
      <AdminHeaderBand withTabs={withTabs} className={className}>
        <AdminHeaderTitleRow>
          <AdminHeaderTitleBlock>
            {eyebrow ? (
              <AdminHeaderEyebrow>{eyebrow}</AdminHeaderEyebrow>
            ) : null}
            <AdminHeaderTitle>{title}</AdminHeaderTitle>
            {subtitle ? (
              <AdminHeaderSubtitle>{subtitle}</AdminHeaderSubtitle>
            ) : null}
            {meta}
          </AdminHeaderTitleBlock>
          {actions ? (
            <div className="flex shrink-0 items-start gap-2">{actions}</div>
          ) : null}
        </AdminHeaderTitleRow>
        {withTabs ? null : null}
      </AdminHeaderBand>
      <Separator />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs (§3)
// ---------------------------------------------------------------------------

const adminTabTriggerClass =
  "rounded-none px-3 after:bg-primary after:bottom-0! data-[state=active]:text-foreground"

function AdminTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      data-slot="admin-tabs-list"
      variant="line"
      className={cn("mt-4 max-w-full justify-start overflow-x-auto", className)}
      {...props}
    />
  )
}

function AdminTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      data-slot="admin-tabs-trigger"
      className={cn(adminTabTriggerClass, className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Cards (§4)
// ---------------------------------------------------------------------------

function DataCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      data-slot="data-card"
      className={cn("gap-0 py-0", className)}
      {...props}
    />
  )
}

function DataCardHeader({
  className,
  ...props
}: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader
      data-slot="data-card-header"
      className={cn(
        "flex flex-row items-center justify-between gap-2 px-4 py-3",
        className
      )}
      {...props}
    />
  )
}

function DataCardTitle({
  icon: Icon,
  actions,
  className,
  children,
  ...props
}: React.ComponentProps<typeof CardTitle> & {
  icon: LucideIcon
  actions?: React.ReactNode
}) {
  return (
    <>
      <CardTitle
        data-slot="data-card-title"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-sm",
          className
        )}
        {...props}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{children}</span>
      </CardTitle>
      {actions}
    </>
  )
}

function DataCardContent({
  variant = "padded",
  className,
  ...props
}: React.ComponentProps<typeof CardContent> & {
  variant?: "padded" | "rows" | "table"
}) {
  return (
    <CardContent
      data-slot="data-card-content"
      data-variant={variant}
      className={cn(
        variant === "padded" && "px-4 py-3",
        variant === "rows" && "px-4 pt-0 pb-0",
        variant === "table" && "px-4 pt-0 pb-0",
        className
      )}
      {...props}
    />
  )
}

function DataCardDivider() {
  return <Separator data-slot="data-card-divider" />
}

// ---------------------------------------------------------------------------
// Tabular rows (§5)
// ---------------------------------------------------------------------------

function DataRowList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-row-list"
      className={cn("-mx-4", className)}
      {...props}
    />
  )
}

function DataRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-row"
      className={cn(
        "border-b border-border px-4 py-3 last:border-0",
        className
      )}
      {...props}
    />
  )
}

function TableBleed({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-bleed"
      className={cn(
        "-mx-4 hidden overflow-x-auto md:block [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4",
        className
      )}
      {...props}
    />
  )
}

function MobileRowList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="mobile-row-list"
      className={cn("-mx-4 divide-y divide-border md:hidden", className)}
      {...props}
    />
  )
}

function RowPrimary({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="row-primary"
      className={cn("truncate text-sm font-medium", className)}
      {...props}
    />
  )
}

function RowSecondary({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="row-secondary"
      className={cn("muted-xs", className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Add-row affordance (§6)
// ---------------------------------------------------------------------------

function GhostAddRow({
  className,
  children,
  icon: Icon = Plus,
  ...props
}: React.ComponentProps<"button"> & { icon?: LucideIcon }) {
  return (
    <div data-slot="ghost-add-row" className="-mx-4 border-t border-border">
      <button
        type="button"
        data-slot="ghost-add-row-button"
        className={cn(
          "flex w-full items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50",
          className
        )}
        {...props}
      >
        <Icon className="h-3.5 w-3.5" />
        {children}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search input in card headers (§4)
// ---------------------------------------------------------------------------

function CardSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  placeholderDesktop,
  ariaLabel = "Search",
  clearLabel = "Clear search",
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  placeholderDesktop?: string
  ariaLabel?: string
  clearLabel?: string
  className?: string
}) {
  const desktopPlaceholder = placeholderDesktop ?? placeholder
  return (
    <div
      role="search"
      data-slot="card-search-input"
      className={cn("relative w-38 shrink-0 sm:w-50", className)}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {placeholderDesktop ? (
        <>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="h-8 bg-background pr-8 pl-8 text-sm md:hidden"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={desktopPlaceholder}
            aria-label={ariaLabel}
            className="hidden h-8 bg-background pr-8 pl-8 text-sm md:block"
          />
        </>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-8 bg-background pr-8 pl-8 text-sm"
        />
      )}
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground pointer-coarse:size-8 pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']"
          onClick={() => onChange("")}
          aria-label={clearLabel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats (§4) / misc
// ---------------------------------------------------------------------------

function StatBlock({
  value,
  label,
  className,
}: {
  value: React.ReactNode
  label: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="stat-block" className={className}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="muted-xs">{label}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
}) {
  return (
    <DataCard className={className}>
      <DataCardContent>
        <StatBlock value={value} label={label} />
      </DataCardContent>
    </DataCard>
  )
}

function RowIconButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="row-icon-button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-8 text-muted-foreground pointer-coarse:size-11",
        className
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Forms (§7)
// ---------------------------------------------------------------------------

function RequiredStar({ className }: { className?: string }) {
  return (
    <span
      data-slot="required-star"
      className={cn("text-destructive", className)}
    >
      {" "}
      *
    </span>
  )
}

function FieldLabelText({ children }: { children: React.ReactNode }) {
  return <span data-slot="field-label-text">{children}</span>
}

function PageShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-shell"
      className={cn("shell-admin", className)}
      {...props}
    />
  )
}

function FormStack({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="form-stack"
      className={cn("form-stack", className)}
      {...props}
    />
  )
}

function SectionStack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-stack"
      className={cn("section-stack", className)}
      {...props}
    />
  )
}

function StackMd({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stack-md"
      className={cn("stack-md", className)}
      {...props}
    />
  )
}

function FieldStack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-stack"
      className={cn("field-stack", className)}
      {...props}
    />
  )
}

function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn("empty-state", className)}
      {...props}
    />
  )
}

function Alert({
  className,
  tone = "warning",
  ...props
}: React.ComponentProps<"div"> & { tone?: "warning" | "error" | "muted" }) {
  return (
    <div
      data-slot="alert"
      data-tone={tone}
      className={cn(
        tone === "warning" && "alert-warning",
        tone === "error" && "alert-error",
        tone === "muted" && "alert-muted",
        className
      )}
      {...props}
    />
  )
}

function MetaRow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="meta-row" className={cn("meta-row", className)} {...props} />
  )
}

export {
  PageShell,
  FormStack,
  SectionStack,
  StackMd,
  FieldStack,
  EmptyState,
  Alert,
  MetaRow,
  AdminPageShell,
  AdminPageBody,
  AdminPageCenter,
  AdminHeaderBand,
  AdminHeaderTitleRow,
  AdminHeaderTitleBlock,
  AdminHeaderEyebrow,
  AdminHeaderTitle,
  AdminHeaderSubtitle,
  AdminHeader,
  AdminTabsList,
  AdminTabsTrigger,
  DataCard,
  DataCardHeader,
  DataCardTitle,
  DataCardContent,
  DataCardDivider,
  DataRowList,
  DataRow,
  TableBleed,
  MobileRowList,
  RowPrimary,
  RowSecondary,
  GhostAddRow,
  CardSearchInput,
  StatBlock,
  StatCard,
  RowIconButton,
  RequiredStar,
  FieldLabelText,
}
