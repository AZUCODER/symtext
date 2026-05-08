import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((request) => {
  if (!request.auth || request.auth.error === "RefreshTokenExpired") {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/dashboard/:path*"],
}
