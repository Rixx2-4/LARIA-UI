import { describe, it, expect, beforeEach } from "vitest"
import { markPlacementOffered, wasPlacementOffered } from "./placement"

describe("oferta una vez por chat", () => {
  beforeEach(() => localStorage.clear())

  it("recuerda los chats en los que ya se ofreció", () => {
    expect(wasPlacementOffered("c1")).toBe(false)
    markPlacementOffered("c1")
    expect(wasPlacementOffered("c1")).toBe(true)
    expect(wasPlacementOffered("c2")).toBe(false)
  })
})
