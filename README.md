# RosterMe
*A simple volunteer scheduling platform for community organizations.*

## Overview
RosterMe is a volunteer scheduling application built for organizations that coordinate people across events, recurring shifts, and day-to-day operations.  
The goal is to make volunteer coordination simple.  
Many organizations still rely on spreadsheets, group chats, and email chains to organize volunteers. RosterMe replaces that with a focused scheduling tool designed specifically for volunteer teams.

### Potential users
- Charities
- Churches
- Food banks
- Animal shelters
- Community outreach groups
- Event organizers
- Local nonprofits

# Product Vision
The core problem RosterMe solves:  
> Coordinators need to create shifts. Volunteers need to sign up. Everyone needs visibility into who is covering what.  
RosterMe should make this easy for both sides.

### Organizers
- Create events
- Create shifts
- Manage volunteers
- Track coverage

### Volunteers
- View available shifts
- Sign up quickly
- Get reminders
- Know where they need to be


# MVP Scope
The MVP is focused entirely on scheduling.  
No payroll, messaging platform, donation management, or unnecessary admin features.


## Organization Management
- Create organization
- Organization profile/settings
- Organization dashboard


## Events
Organizers can create events such as:
- Saturday food bank
- Sunday welcome desk
- Animal shelter morning shift
- Community cleanup day

### Event fields
- title
- description
- location
- date
- start time
- end time

## Shift Slots
Each event can contain one or more volunteer slots. For example:  
Saturday Food Bank:  
- 08:00-10:00 → 4-5 volunteers
- 10:00-12:00 → 4-6 volunteers
- 12:00-14:00 → 3 volunteers

### Slot fields
- start time
- end time
- volunteers required (minimum - maximum)
- notes (optional)

## Volunteer Signup
Volunteers can:
- open signup link
- enter name
- enter email
- select shift
- receive confirmation email

### Important
For MVP, volunteers should **not** be forced to create an account.  
Low-friction signup is a priority.

## Organizer Dashboard
Organizers can:
- view upcoming events
- see who signed up
- see which shifts are full
- see which shifts still need volunteers
- cancel or manage signups
- export volunteer list

## Email Notifications
Automated emails:
- signup confirmation
- cancellation confirmation
- shift reminder

# Future Features (Post-MVP)
These are intentionally out of scope for the first release.

## Recurring Scheduling
Examples:
- Every Saturday
- Every first Sunday of the month
- Every Wednesday evening

## Volunteer Availability Preferences
Examples:
- Available weekdays only
- Available evenings only
- Not available during holidays

## Waitlists
- Join waitlist when shift is full
- Auto-promote when a spot opens

## Role-Based Assignments
Examples:
- Team Lead
- Driver
- Setup Crew
- Kitchen Volunteer

## Reporting
- Volunteer hours
- Attendance
- No-shows
- Monthly exports

## Organization Branding
Paid feature:
- custom logo
- custom email branding
- remove RosterMe branding

## Multi-Location Support
For organizations operating across multiple:
- locations
- campuses
- shelters
- event venues

## Enterprise Authentication
Potential future support for:
- Google Workspace
- Microsoft login
- SAML / SSO

# Monetization (Future)
MVP will launch fully free.  
Potential pricing structure later:  

## Free
Designed for small organizations.  
Includes:
- 1 organization
- unlimited events
- volunteer signup links
- email reminders

## Pro
Potential additions:
- recurring schedules
- waitlists
- volunteer availability preferences
- reporting
- custom branding

# Tech Stack

## Frontend
- React
- TypeScript
- TanStack Query
- Tailwind CSS
- shadcn/ui

## Backend
- .NET
- ASP.NET Core Web API
- Entity Framework Core

## Database
- PostgreSQL

## Infrastructure
- Docker

## Authentication
- Clerk

Clerk handles:
- sign in
- sign up
- magic links
- session management
- OAuth providers
- email verification

Application-specific user data remains stored in PostgreSQL.

## Background Jobs
Planned:
- Hangfire

Used for:
- email reminders
- scheduled jobs
- recurring shift generation
- cleanup tasks

## Email Delivery
Planned:
- Resend

Used for:
- signup confirmation
- reminder emails
- cancellations
- invitations

# API Documentation

The backend exposes a machine-readable OpenAPI specification.

## Scalar UI (interactive API docs)
When the backend is running, browse to:
```
http://localhost:5000/scalar/v1
```

## Raw OpenAPI JSON
```
http://localhost:5000/openapi/v1.json
```

## Frontend type generation
TypeScript types are auto-generated from the OpenAPI spec using `openapi-typescript`.  
With the backend running:
```
cd client
npm run generate:types
```
This updates `client/src/lib/generated/schema.ts`. The file `client/src/lib/types.ts` re-exports from the generated schema under friendly names.

# UI / Design Direction
Design goals:
- simple
- warm
- trustworthy
- minimal friction
- mobile-friendly

Avoid:
- overly corporate enterprise UI
- dense dashboards
- complicated navigation

Prioritize:
- readability
- fast workflows
- easy shift creation
- easy volunteer signup

### Visual style ideas
- soft white / neutral background
- teal or sage accent colors
- rounded cards
- spacious forms
- clean scheduling/calendar views

# Initial Development Roadmap
## Phase 1 — Foundation
- repository setup
- Docker environment
- database setup
- backend API setup
- frontend app setup
- Clerk authentication integration

## Phase 2 — Scheduling Core
- organizations
- events
- shift slots
- volunteer signup flow

## Phase 3 — Organizer Dashboard
- event management
- volunteer assignment management
- shift coverage overview

## Phase 4 — Notifications
- signup confirmations
- reminder emails
- cancellation emails

## Phase 5 — MVP Launch
- deploy application
- onboard first real users
- collect feedback
- iterate

# Long-Term Goal
Build the easiest volunteer scheduling platform for small and medium-sized organizations.

Success means an organizer can:
- create an event in minutes
- share a signup link
- fill volunteer slots without chasing people manually
- keep everyone informed with minimal effort

If RosterMe removes the need for spreadsheets, endless group messages, and manual follow-up, it is doing its job.