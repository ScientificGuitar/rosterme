import { Link } from "react-router-dom"

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-sm text-muted-foreground">
        <span>&copy; {year} RosterMe</span>
        <nav className="flex items-center gap-4" aria-label="Legal">
          <Link
            to="/terms-of-service"
            className="hover:text-foreground hover:underline"
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy-policy"
            className="hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
