export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/"
  }
  return pathname.startsWith(href)
}
