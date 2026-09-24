"use client"

import { Search } from "./components/search-interface"
import { RequireAuth } from "./components/require-auth"

export default function Home() {
  return (
    <RequireAuth>
      <Search />
    </RequireAuth>
  )
}
