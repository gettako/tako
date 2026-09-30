"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  GearIcon,
  BookOpenIcon,
  SignOutIcon,
  Sun,
  Moon,
  UserIcon,
} from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { getDiceBearAvatar } from "@/lib/utils"
import { clearSessionCookie } from "@/lib/auth"

interface NavUserProps {
  user?: {
    name: string
    email: string
    avatar?: string
  }
}

const defaultUser = {
  name: "Admin",
  email: "admin@tako.local",
  avatar: getDiceBearAvatar("admin@tako.local"),
}

export function NavUser({ user = defaultUser }: NavUserProps = {}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [currentUser, setCurrentUser] = React.useState({
    name: user?.name || "Admin",
    email: user?.email || "admin@tako.local",
    avatar:
      user?.avatar || getDiceBearAvatar(user?.email || "admin@tako.local"),
  })

  React.useEffect(() => {
    let mounted = true
    api.auth
      .getMe()
      .then((me) => {
        if (mounted && me) {
          const email = me.email || "admin@tako.local"
          setCurrentUser({
            name: me.name || me.email?.split("@")[0] || "Admin",
            email,
            avatar: getDiceBearAvatar(email),
          })
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [user?.avatar])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch {}
    clearSessionCookie()
    router.push("/login")
  }

  const initials = currentUser.name.slice(0, 2).toUpperCase() || "TA"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="nav-user-trigger"
        aria-label={`User account menu for ${currentUser.name}`}
        className="flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition-opacity outline-none select-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar className="size-8 border border-border">
          <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
          <AvatarFallback className="text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="sr-only">{currentUser.name}</span>
        <span className="sr-only">{currentUser.email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align="end"
        side="bottom"
        sideOffset={6}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2.5 px-2.5 py-2 text-left">
              <Avatar className="size-8 border border-border">
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                <AvatarFallback className="text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                <span className="truncate font-medium text-foreground">
                  {currentUser.name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {currentUser.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push("/profile")}
            className="cursor-pointer"
          >
            <UserIcon className="size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push("/settings")}
            className="cursor-pointer"
          >
            <GearIcon className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              window.open("https://github.com/gettako/tako", "_blank")
            }
            className="cursor-pointer"
          >
            <BookOpenIcon className="size-4" />
            Documentation
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={toggleTheme}
            className="cursor-pointer"
            aria-label="Toggle theme"
            data-testid="theme-toggle-menu-item"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
            <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <SignOutIcon className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
