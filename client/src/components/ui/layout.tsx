import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Centralized shared layout primitives.
 * Width/spacing live here + in `@layer components` (index.css);
 * per-instance tweaks still go through `className`.
 */

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
}
