"use client"

import {
  ArrowUpRight,
  BookOpenText,
  Lightbulb,
  MagnifyingGlass,
  Package,
  Wrench,
  type Icon,
} from "@phosphor-icons/react"
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

/* Scale notes: header chrome is Figma (1920 frame) × 0.73, the navigation
   pill and its dropdown panels are Figma × 0.8. */

/* Pill segment. Hover previews the same white gradient + underline the open
   state uses — no separate hover tint — so the trigger reads as one motion
   when the panel opens (Root has delay={0}). The gradient lives on a ::before
   overlay (background-image itself cannot transition) so it can fade in fast;
   the ::after underline fades on the same clock. Class names are written out
   in full because Tailwind's scanner only sees complete literals. */
const segmentClass = cn(
  "relative flex h-full w-max items-center rounded-none px-[17px]",
  "text-[22.4px] font-semibold tracking-[-0.03em] text-white",
  "bg-transparent hover:bg-transparent focus:bg-transparent focus-visible:ring-0 focus-visible:outline-none",
  "data-popup-open:bg-transparent data-popup-open:hover:bg-transparent data-popup-open:focus:bg-transparent",
  "data-open:bg-transparent data-open:hover:bg-transparent data-open:focus:bg-transparent",
  // gradient overlay
  "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-150 before:ease-out",
  "before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "hover:before:opacity-100 data-popup-open:before:opacity-100",
  // underline
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white after:opacity-0 after:transition-opacity after:duration-150 after:ease-out",
  "hover:after:opacity-100 data-popup-open:after:opacity-100"
)

/* Only the outermost segments bleed their gradient/underline past the pill's
   7px edge padding, so the effect meets the pill's rounded corners without
   spilling into the gaps between neighbouring items. */
const bleedLeftClass = "before:-left-[7px] after:-left-[7px]"
const bleedRightClass = "before:-right-[7px] after:-right-[7px]"

/* Drop shadow lives on the icon+label row, NOT the whole segment — on the
   segment it would also shadow the white gradient rectangle and smear a dark
   rim around the text. z-10 keeps the row above the gradient overlay. */
const segmentContentClass =
  "relative z-10 flex items-center gap-[10px] [filter:drop-shadow(0px_1.5px_4px_rgba(0,0,0,0.35))]"

/* The blue checker border chrome and the white surface live on the POPUP and
   VIEWPORT (see popupClassName / viewportClassName on <NavigationMenu>), not
   inside each panel — the popup is the element whose size actually animates
   during a panel-to-panel morph, so chrome attached to it stretches smoothly
   instead of clipping or flashing white. Panels below are pure content. */
const popupChromeClass = cn(
  "overflow-hidden rounded-[14px] bg-[#01A6FF] p-[6px] text-foreground ring-0",
  "shadow-[0px_3px_13px_0px_rgba(0,0,0,0.25)]",
  // rotated blue checkerboard, same family as the header's
  "before:absolute before:-inset-[60%] before:rotate-[-16.06deg]",
  "before:[background-image:conic-gradient(#01BBFF_0_25%,#01A6FF_0_50%,#01BBFF_0_75%,#01A6FF_0)]",
  "before:[background-size:180px_180px]",
  // cyan gradient that deepens toward the bottom
  "after:absolute after:inset-0 after:bg-gradient-to-b after:from-[rgba(1,206,242,0)] after:to-[rgba(1,206,242,0.7)]"
)

const viewportChromeClass =
  "z-10 rounded-[8px] bg-white shadow-[0px_3px_5px_0px_rgba(0,0,0,0.25)]"

/* One hoverable link row — shared by every panel's item list. */
function PanelItem({
  title,
  description,
  descriptionClass,
}: {
  title: string
  description: string
  descriptionClass?: string
}) {
  return (
    <NavigationMenuLink
      href="#"
      className="flex-col items-start gap-[2px] rounded-[8px] px-[12px] py-[9px] hover:bg-[#f3f3f3] focus:bg-[#f3f3f3]"
    >
      <span className="text-[16px] font-semibold tracking-[-0.03em] text-black">
        {title}
      </span>
      <span
        className={cn(
          "text-[12px] leading-[normal] tracking-[-0.03em] text-black/50",
          descriptionClass
        )}
      >
        {description}
      </span>
    </NavigationMenuLink>
  )
}

/* "Check out all …" footer button — shared by every panel. */
function PanelFooter({ children }: { children: React.ReactNode }) {
  return (
    <NavigationMenuLink
      href="#"
      className="mt-auto flex h-[36px] w-full shrink-0 items-center justify-center gap-[6px] rounded-[7px] bg-[#f3f3f3] p-0 text-[13px] font-medium tracking-[-0.03em] text-[#5b5b5b] hover:bg-[#ececec] focus:bg-[#ececec]"
    >
      {children}
      <ArrowUpRight size={12} weight="bold" aria-hidden />
    </NavigationMenuLink>
  )
}

function GuidesPanel() {
  return (
    <div className="flex h-full w-full pt-[13px] pr-[12px] pb-[12px] pl-[14px]">
        {/* Start here! card */}
        <NavigationMenuLink
          href="#"
          className="relative block h-[302px] w-[244px] shrink-0 overflow-hidden rounded-[7px] border-[3px] border-solid border-[#ff902f] p-0 hover:bg-transparent focus:bg-transparent"
        >
          <div
            aria-hidden
            className="absolute -inset-[60%] rotate-[-8.66deg]"
            style={{
              backgroundImage:
                "conic-gradient(#ffbb01 0 25%, #ffa201 0 50%, #ffbb01 0 75%, #ffa201 0)",
              backgroundSize: "120px 120px",
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

          <span className="absolute top-[13px] right-[11px] flex h-[25px] items-center gap-[6px] rounded-full bg-[#170117] px-[11px] text-[13px] font-semibold tracking-[-0.03em] text-white">
            Zero To One
            <ArrowUpRight size={12} weight="bold" aria-hidden />
          </span>

          <span className="absolute top-[43px] left-0 w-full text-center font-augie text-[29px] tracking-[-0.05em] text-white [text-shadow:0px_1.5px_6px_rgba(0,0,0,0.25)]">
            beginner?
          </span>

          <span className="absolute bottom-[20px] left-[13px] font-augie text-[51px] leading-none tracking-[-0.05em] text-white [text-shadow:0px_1.5px_8px_rgba(0,0,0,0.4)]">
            Start here!
          </span>
        </NavigationMenuLink>

        {/* guide links — same rows as the items-only panels */}
        <div className="flex min-w-0 flex-1 flex-col gap-[4px] pt-[6px] pl-[9px]">
          <PanelItem
            title="Macropad"
            description="Build a tiny keyboard. Design, solder, and use it everyday."
            descriptionClass="w-[160px]"
          />
          <PanelItem
            title="Tamagotchi"
            description="Build a pocket pet from scratch!"
            descriptionClass="w-[160px]"
          />
          <PanelFooter>Check out all guides</PanelFooter>
        </div>
    </div>
  )
}

/* Items-only panel for the remaining sections. */
function ItemsPanel({
  items,
  footer,
}: {
  items: { title: string; description: string }[]
  footer: string
}) {
  return (
    <div className="flex w-full flex-col gap-[4px] p-[8px]">
      {items.map((item) => (
        <PanelItem
          key={item.title}
          title={item.title}
          description={item.description}
        />
      ))}
      <PanelFooter>{footer}</PanelFooter>
    </div>
  )
}

const sections: {
  label: string
  icon: Icon
  iconSize: number
  footer: string
  items: { title: string; description: string }[]
}[] = [
  {
    label: "Concepts",
    icon: Lightbulb,
    iconSize: 26,
    footer: "Check out all concepts",
    items: [
      { title: "Voltage & Current", description: "What actually flows through a wire." },
      { title: "Resistors", description: "Taming electrons, one ohm at a time." },
      { title: "Microcontrollers", description: "Tiny computers that run your ideas." },
      { title: "PCB Basics", description: "From breadboard mess to a real board." },
    ],
  },
  {
    label: "Tools",
    icon: Wrench,
    iconSize: 24,
    footer: "Check out all tools",
    items: [
      { title: "Simulator", description: "Test circuits in your browser first." },
      { title: "PCB Editor", description: "Design boards you can actually order." },
      { title: "Firmware Flasher", description: "Get your code onto the chip." },
    ],
  },
  {
    label: "Library",
    icon: Package,
    iconSize: 26,
    footer: "Check out the full library",
    items: [
      { title: "Parts Library", description: "Every component jolts ships with." },
      { title: "Datasheets", description: "The fine print, made readable." },
      { title: "Community Builds", description: "What other hack clubbers made." },
    ],
  },
]

export function SiteHeader() {
  return (
    <header className="relative z-40 h-[91px] w-full">
      {/* checkerboard background — pure CSS, no SVG involved */}
      <div className="absolute inset-0 overflow-hidden shadow-[0px_3px_19px_0px_rgba(1,187,255,0.25)]">
        <div
          aria-hidden
          className="absolute -inset-x-[10%] -inset-y-[250px] rotate-[-14.59deg] bg-[#01A6FF]"
          style={{
            backgroundImage:
              "conic-gradient(#01BBFF 0 25%, #01A6FF 0 50%, #01BBFF 0 75%, #01A6FF 0)",
            backgroundSize: "132px 132px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[rgba(1,242,255,0.1)] to-[rgba(1,242,255,0.6)]"
        />
        <div aria-hidden className="absolute inset-0 bg-black/5" />
      </div>

      <div className="relative flex h-full items-start pr-[35px] pl-[54px]">
        {/* logo hangs below the header bar */}
        <Link
          href="/"
          className="relative z-10 mt-[12px] w-[200px] shrink-0 self-start"
        >
          <img
            src="/brand/jolts-logo.svg"
            alt="Hack Club jolts — learn to build real things"
            className="h-auto w-[200px] max-w-none"
          />
        </Link>

        <NavigationMenu
          delay={0}
          className="mt-[24px] ml-[32px] max-w-none flex-none justify-start"
          sideOffset={26}
          popupClassName={popupChromeClass}
          viewportClassName={viewportChromeClass}
        >
          <NavigationMenuList className="h-[54px] w-max flex-none justify-start gap-0 overflow-hidden rounded-[4px] bg-white/20 px-[7px]">
            <NavigationMenuItem className="h-full">
              <NavigationMenuTrigger className={cn(segmentClass, bleedLeftClass)}>
                <span className={segmentContentClass}>
                  <BookOpenText size={26} weight="fill" aria-hidden />
                  Guides
                </span>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="h-[329px] w-[476px] p-0">
                <GuidesPanel />
              </NavigationMenuContent>
            </NavigationMenuItem>

            {sections.map((section, i) => (
              <NavigationMenuItem key={section.label} className="h-full">
                <NavigationMenuTrigger
                  className={cn(
                    segmentClass,
                    i === sections.length - 1 && bleedRightClass
                  )}
                >
                  <span className={segmentContentClass}>
                    <section.icon
                      size={section.iconSize}
                      weight="fill"
                      aria-hidden
                    />
                    {section.label}
                  </span>
                </NavigationMenuTrigger>
                <NavigationMenuContent className="w-[292px] p-0">
                  <ItemsPanel items={section.items} footer={section.footer} />
                </NavigationMenuContent>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* search */}
        <button
          type="button"
          aria-label="Search"
          className={cn(
            "relative mt-[25px] ml-auto flex size-[49px] items-center justify-center overflow-hidden rounded-[4px] bg-white/20",
            // same fading gradient overlay as the pill segments
            "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-150 before:ease-out",
            "before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
            "hover:before:opacity-100",
            // pressed: swap the overlay for a stronger gradient
            "active:before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.55)_92%,rgba(255,255,255,0.8)_100%)]",
            "active:before:opacity-100",
            // and the line thing
            "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white after:opacity-0 after:transition-opacity after:duration-150 after:ease-out",
            "hover:after:opacity-100 active:after:opacity-100"
          )}
        >
          <MagnifyingGlass
            size={22}
            weight="bold"
            aria-hidden
            className="relative z-10 text-white [filter:drop-shadow(0px_1.5px_4px_rgba(0,0,0,0.35))]"
          />
        </button>
      </div>
    </header>
  )
}
