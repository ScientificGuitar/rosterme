import { UserButton } from "@clerk/react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

/** UserButton with a light/dark mode item inside its popup menu. */
export function ThemedUserButton() {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={isDark ? "Light mode" : "Dark mode"}
          labelIcon={
            isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
          }
          onClick={() => setTheme(isDark ? "light" : "dark")}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
