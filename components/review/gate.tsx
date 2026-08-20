"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

import { CircleNotch, WarningCircle } from "@phosphor-icons/react"

import { CheckerFrame } from "@/components/checker-frame"
import { GithubMark } from "@/components/github-mark"
import { connect } from "@/lib/github/client"
import { checkCurator, type CuratorState } from "@/lib/review/client"
import { chromeTheme } from "@/lib/theme"
import type { GhUser } from "@/lib/github/types"

/* Every review page hangs off this. Three outcomes: signed out (offer GitHub),
   signed in without write access (say so plainly - it isn't an error on their
   part), or a curator, in which case the page renders.

   The curator reaches children through context rather than a render prop: these
   gates wrap JSX handed down from server components, and a function can't cross
   that boundary. */

const CuratorCtx = createContext<GhUser | null>(null)

/** The signed-in curator. Only valid inside CuratorGate, which never renders
    its children until it has one. */
export function useCurator(): GhUser {
  const user = useContext(CuratorCtx)
  if (!user) throw new Error("useCurator outside CuratorGate")
  return user
}

export function CuratorGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CuratorState | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    checkCurator()
      .then(setState)
      .catch((err: Error) => {
        setError(err.message)
        setState({ status: "signed-out" })
      })
  }, [])

  useEffect(refresh, [refresh])

  const onConnect = async () => {
    setError(null)
    setConnecting(true)
    try {
      await connect()
      setState(null)
      refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  if (state === null) {
    return (
      <Centered>
        <p className="flex items-center gap-[9px] text-[14px] text-[#9aa1ab]">
          <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
          Checking your access…
        </p>
      </Centered>
    )
  }

  if (state.status === "curator") {
    return <CuratorCtx.Provider value={state.user}>{children}</CuratorCtx.Provider>
  }

  return (
    <Centered>
      <div className="w-full max-w-[440px]">
        <CheckerFrame theme={chromeTheme} checkerSize={150}>
          <p className="relative px-[10px] pt-[3px] pb-[9px] text-[14.5px] font-semibold tracking-[-0.02em] text-white [filter:drop-shadow(0px_1px_3px_rgba(0,0,0,0.25))]">
            Curator review
          </p>
          <div className="relative rounded-[7px] bg-white px-[18px] py-[16px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]">
            {state.status === "signed-out" ? (
              <>
                <p className="flex items-center gap-[8px] text-[15px] font-semibold tracking-[-0.01em] text-[#16181d]">
                  <GithubMark size={17} />
                  Sign in to review
                </p>
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={connecting}
                  className="mt-[13px] flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#16181d] py-[9px] text-[14.5px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-black disabled:opacity-60"
                >
                  {connecting ? (
                    <>
                      <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
                      Waiting for GitHub…
                    </>
                  ) : (
                    <>
                      <GithubMark size={16} />
                      Continue with GitHub
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-[8px] text-[15px] font-semibold tracking-[-0.01em] text-[#16181d]">
                  <WarningCircle size={18} weight="fill" className="text-[#FF902F]" aria-hidden />
                  Not a curator yet
                </p>
                <p className="mt-[5px] text-[13px] leading-[1.6] text-[#5c6470]">
                  {state.message}
                </p>
              </>
            )}
            {error && (
              <p className="mt-[11px] rounded-[9px] border border-[#d43c3c]/25 bg-[#fdecec] px-[11px] py-[8px] text-[12.5px] leading-[1.5] text-[#a12222]">
                {error}
              </p>
            )}
          </div>
        </CheckerFrame>
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-[28px] py-[48px]">
      {children}
    </div>
  )
}
