"use client"

import Link from "next/link"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

/* All dimensions are the Figma values (designed on a 1920 frame) × 0.7. */

/* Shared look for every pill segment (trigger or plain link). Figma: Open
   Runde Semibold, -5% tracking, white, soft drop shadow; the open item gets a
   white bottom-weighted gradient plus a 1px underline. */
const segmentClass = cn(
  "relative flex h-full w-max items-center rounded-none px-[13px]",
  "text-[19.6px] font-semibold tracking-[-0.05em] text-white",
  "bg-transparent hover:bg-white/10 focus:bg-white/10 focus-visible:ring-0 focus-visible:outline-none",
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white after:opacity-0",
  "data-popup-open:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "data-popup-open:hover:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "data-popup-open:bg-transparent data-popup-open:hover:bg-transparent data-popup-open:focus:bg-transparent",
  "data-open:bg-transparent data-open:hover:bg-transparent data-open:focus:bg-transparent",
  "data-popup-open:after:opacity-100"
)

/* The drop shadow lives on the icon+label row, NOT on the whole segment —
   putting it on the segment would shadow the white active-gradient rectangle
   as well, which smears a dark rim around the text. */
const segmentContentClass =
  "flex items-center gap-[9px] [filter:drop-shadow(0px_1.4px_3.5px_rgba(0,0,0,0.35))]"

function GuidesPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[13px] bg-[#d3e4e9] p-[6px]">
      {/* cyan border chrome: tone-on-tone checker under a cyan gradient */}
      <div
        aria-hidden
        className="absolute -inset-[60%] rotate-[-14.59deg]"
        style={{
          backgroundImage:
            "conic-gradient(rgba(1,206,242,0.28) 0 25%, rgba(1,206,242,0.1) 0 50%, rgba(1,206,242,0.28) 0 75%, rgba(1,206,242,0.1) 0)",
          backgroundSize: "126px 126px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[rgba(1,206,242,0)] to-[rgba(1,206,242,0.75)]"
      />

      {/* inner white panel */}
      <div className="relative flex h-full w-full overflow-hidden rounded-[7px] bg-white pt-[12px] pr-[11px] pb-[11px] pl-[13px] shadow-[0px_3px_4px_0px_rgba(0,0,0,0.25)]">
        {/* Start here! card */}
        <NavigationMenuLink
          href="#"
          className="relative block h-[264px] w-[214px] shrink-0 overflow-hidden rounded-[6px] border-[3px] border-solid border-[#ff902f] p-0 hover:bg-transparent focus:bg-transparent"
        >
          {/* orange checkerboard */}
          <div
            aria-hidden
            className="absolute -inset-[60%] rotate-[-8.66deg]"
            style={{
              backgroundImage:
                "conic-gradient(#ffbb01 0 25%, #ffa201 0 50%, #ffbb01 0 75%, #ffa201 0)",
              backgroundSize: "105px 105px",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(67deg, rgba(255,214,1,0) 21.354%, rgba(255,211,1,0.8) 69.365%)",
            }}
          />

          <span className="absolute top-[12px] right-[10px] flex h-[22px] items-center gap-[5px] rounded-full bg-[#170117] px-[10px] text-[11px] font-semibold tracking-[-0.05em] text-white">
            Zero To One
            <img
              src="/brand/icon-arrow-chip.svg"
              alt=""
              className="h-[8px] w-[8px]"
            />
          </span>

          <span className="absolute top-[38px] left-0 w-full text-center font-augie text-[25px] tracking-[-0.05em] text-white [text-shadow:0px_1.4px_5px_rgba(0,0,0,0.25)]">
            beginner?
          </span>

          <span className="absolute bottom-[18px] left-[12px] font-augie text-[45px] leading-none tracking-[-0.05em] text-white [text-shadow:0px_1.4px_7px_rgba(0,0,0,0.4)]">
            Start here!
          </span>
        </NavigationMenuLink>

        {/* guide links */}
        <div className="flex min-w-0 flex-1 flex-col pt-[15px] pl-[18px]">
          <NavigationMenuLink
            href="#"
            className="flex-col items-start gap-[3px] rounded-md p-0 hover:bg-transparent focus:bg-transparent"
          >
            <span className="text-[14px] font-semibold tracking-[-0.05em] text-black">
              Macropad
            </span>
            <span className="w-[133px] text-[11px] leading-[normal] tracking-[-0.05em] text-black/50">
              Build a tiny keyboard. Design, solder, and use it everyday.
            </span>
          </NavigationMenuLink>

          <NavigationMenuLink
            href="#"
            className="mt-[13px] flex-col items-start gap-[3px] rounded-md p-0 hover:bg-transparent focus:bg-transparent"
          >
            <span className="text-[14px] font-semibold tracking-[-0.05em] text-black">
              Tamagotchi
            </span>
            <span className="w-[133px] text-[11px] leading-[normal] tracking-[-0.05em] text-black/50">
              Build a pocket pet from scratch!
            </span>
          </NavigationMenuLink>

          <NavigationMenuLink
            href="#"
            className="mt-auto flex h-[32px] items-center justify-center gap-[6px] rounded-[6px] bg-[#f3f3f3] p-0 text-[11px] font-medium tracking-[-0.05em] text-[#5b5b5b] hover:bg-[#ececec] focus:bg-[#ececec]"
          >
            Check out all guides
            <img
              src="/brand/icon-arrow-guides.svg"
              alt=""
              className="h-[8px] w-[8px]"
            />
          </NavigationMenuLink>
        </div>
      </div>
    </div>
  )
}

const plainItems = [
  {
    label: "Concepts",
    icon: "/brand/icon-concepts.svg",
    iconClass: "h-[21px] w-[17px]",
  },
  {
    label: "Tools",
    icon: "/brand/icon-tools.svg",
    iconClass: "h-[20px] w-[20px]",
  },
  {
    label: "Library",
    icon: "/brand/icon-library.svg",
    iconClass: "h-[22px] w-[20px]",
  },
]

export function SiteHeader() {
  return (
    <header className="relative z-40 h-[88px] w-full">
      {/* checkerboard background — pure CSS, no SVG involved */}
      <div className="absolute inset-0 overflow-hidden shadow-[0px_3px_18px_0px_rgba(1,187,255,0.25)]">
        <div
          aria-hidden
          className="absolute -inset-x-[10%] -inset-y-[250px] rotate-[-14.59deg] bg-[#01A6FF]"
          style={{
            backgroundImage:
              "conic-gradient(#01BBFF 0 25%, #01A6FF 0 50%, #01BBFF 0 75%, #01A6FF 0)",
            backgroundSize: "126px 126px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[rgba(1,242,255,0.1)] to-[rgba(1,242,255,0.6)]"
        />
        <div aria-hidden className="absolute inset-0 bg-black/5" />
      </div>

      <div className="relative flex h-full items-start pr-[34px] pl-[52px]">
        {/* logo hangs below the header bar */}
        <Link
          href="/"
          className="relative z-10 mt-[12px] w-[192px] shrink-0 self-start"
        >
          <img
            src="/brand/jolts-logo.svg"
            alt="Hack Club jolts — learn to build real things"
            className="h-auto w-[192px] max-w-none"
          />
        </Link>

        <NavigationMenu
          className="mt-[26px] ml-[31px] max-w-none flex-none justify-start"
          sideOffset={22}
          popupClassName="rounded-[13px] bg-transparent text-foreground shadow-[0px_3px_11px_0px_rgba(0,0,0,0.25)] ring-0"
        >
          <NavigationMenuList className="h-[48px] w-[491px] flex-none justify-start gap-0 overflow-hidden rounded-[4px] bg-white/20">
            <NavigationMenuItem className="h-full">
              <NavigationMenuTrigger className={cn(segmentClass, "pl-[19px]")}>
                <span className={segmentContentClass}>
                  <img
                    src="/brand/icon-guides.svg"
                    alt=""
                    className="h-[20px] w-[24px]"
                  />
                  Guides
                </span>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="h-[298px] w-[427px] p-0">
                <GuidesPanel />
              </NavigationMenuContent>
            </NavigationMenuItem>

            {plainItems.map((item) => (
              <NavigationMenuItem key={item.label} className="h-full">
                <NavigationMenuLink href="#" className={segmentClass}>
                  <span className={segmentContentClass}>
                    <img src={item.icon} alt="" className={item.iconClass} />
                    {item.label}
                  </span>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* search */}
        <button
          type="button"
          aria-label="Search"
          className="mt-[27px] ml-auto flex size-[48px] items-center justify-center rounded-[4px] bg-white/20 transition-colors hover:bg-white/30"
        >
          <img src="/brand/icon-search.svg" alt="" className="h-[21px] w-[21px]" />
        </button>
      </div>
    </header>
  )
}
