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

/* Scale notes: header chrome is Figma (1920 frame) × 0.73, the navigation
   pill and its dropdown panels are Figma × 0.84. */

/* Pill segment. Hover previews the same white gradient + underline the open
   state uses — no separate hover tint — so the trigger reads as one motion
   when the panel opens (Root has delay={0}). Class names are written out in
   full because Tailwind's scanner only sees complete literals. */
const segmentClass = cn(
  "relative flex h-full w-max items-center rounded-none px-[16px]",
  "text-[23.5px] font-semibold tracking-[-0.03em] text-white",
  "bg-transparent focus:bg-transparent focus-visible:ring-0 focus-visible:outline-none",
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white after:opacity-0",
  "hover:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "hover:after:opacity-100",
  "data-popup-open:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "data-popup-open:hover:bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.4)_92%,rgba(255,255,255,0.6)_100%)]",
  "hover:bg-transparent data-popup-open:bg-transparent data-popup-open:hover:bg-transparent data-popup-open:focus:bg-transparent",
  "data-open:bg-transparent data-open:hover:bg-transparent data-open:focus:bg-transparent",
  "data-popup-open:after:opacity-100"
)

/* Drop shadow lives on the icon+label row, NOT the whole segment — on the
   segment it would also shadow the white gradient rectangle and smear a dark
   rim around the text. */
const segmentContentClass =
  "flex items-center gap-[11px] [filter:drop-shadow(0px_1.5px_4px_rgba(0,0,0,0.35))]"

/* Cyan checker border chrome shared by every dropdown panel. */
function PanelChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[15px] bg-[#d3e4e9] p-[7px]">
      <div
        aria-hidden
        className="absolute -inset-[60%] rotate-[-14.59deg]"
        style={{
          backgroundImage:
            "conic-gradient(rgba(1,206,242,0.28) 0 25%, rgba(1,206,242,0.1) 0 50%, rgba(1,206,242,0.28) 0 75%, rgba(1,206,242,0.1) 0)",
          backgroundSize: "151px 151px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[rgba(1,206,242,0)] to-[rgba(1,206,242,0.75)]"
      />
      <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-white shadow-[0px_3px_5px_0px_rgba(0,0,0,0.25)]">
        {children}
      </div>
    </div>
  )
}

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
      <span className="text-[17px] font-semibold tracking-[-0.03em] text-black">
        {title}
      </span>
      <span
        className={cn(
          "text-[13px] leading-[normal] tracking-[-0.03em] text-black/50",
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
      className="mt-auto flex h-[38px] w-full shrink-0 items-center justify-center gap-[7px] rounded-[8px] bg-[#f3f3f3] p-0 text-[13px] font-medium tracking-[-0.03em] text-[#5b5b5b] hover:bg-[#ececec] focus:bg-[#ececec]"
    >
      {children}
      <img
        src="/brand/icon-arrow-guides.svg"
        alt=""
        className="h-[10px] w-[10px]"
      />
    </NavigationMenuLink>
  )
}

function GuidesPanel() {
  return (
    <PanelChrome>
      <div className="flex h-full w-full pt-[14px] pr-[13px] pb-[13px] pl-[15px]">
        {/* Start here! card */}
        <NavigationMenuLink
          href="#"
          className="relative block h-[317px] w-[256px] shrink-0 overflow-hidden rounded-[8px] border-[3px] border-solid border-[#ff902f] p-0 hover:bg-transparent focus:bg-transparent"
        >
          <div
            aria-hidden
            className="absolute -inset-[60%] rotate-[-8.66deg]"
            style={{
              backgroundImage:
                "conic-gradient(#ffbb01 0 25%, #ffa201 0 50%, #ffbb01 0 75%, #ffa201 0)",
              backgroundSize: "126px 126px",
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

          <span className="absolute top-[14px] right-[12px] flex h-[26px] items-center gap-[6px] rounded-full bg-[#170117] px-[12px] text-[13px] font-semibold tracking-[-0.03em] text-white">
            Zero To One
            <img
              src="/brand/icon-arrow-chip.svg"
              alt=""
              className="h-[10px] w-[10px]"
            />
          </span>

          <span className="absolute top-[45px] left-0 w-full text-center font-augie text-[30px] tracking-[-0.05em] text-white [text-shadow:0px_1.5px_6px_rgba(0,0,0,0.25)]">
            beginner?
          </span>

          <span className="absolute bottom-[21px] left-[14px] font-augie text-[54px] leading-none tracking-[-0.05em] text-white [text-shadow:0px_1.5px_8px_rgba(0,0,0,0.4)]">
            Start here!
          </span>
        </NavigationMenuLink>

        {/* guide links — same rows as the items-only panels */}
        <div className="flex min-w-0 flex-1 flex-col gap-[4px] pt-[7px] pl-[10px]">
          <PanelItem
            title="Macropad"
            description="Build a tiny keyboard. Design, solder, and use it everyday."
            descriptionClass="w-[170px]"
          />
          <PanelItem
            title="Tamagotchi"
            description="Build a pocket pet from scratch!"
            descriptionClass="w-[170px]"
          />
          <PanelFooter>Check out all guides</PanelFooter>
        </div>
      </div>
    </PanelChrome>
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
    <PanelChrome>
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
    </PanelChrome>
  )
}

const sections: {
  label: string
  icon: string
  iconClass: string
  footer: string
  items: { title: string; description: string }[]
}[] = [
  {
    label: "Concepts",
    icon: "/brand/icon-concepts.svg",
    iconClass: "h-[26px] w-[20px]",
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
    icon: "/brand/icon-tools.svg",
    iconClass: "h-[24px] w-[24px]",
    footer: "Check out all tools",
    items: [
      { title: "Simulator", description: "Test circuits in your browser first." },
      { title: "PCB Editor", description: "Design boards you can actually order." },
      { title: "Firmware Flasher", description: "Get your code onto the chip." },
    ],
  },
  {
    label: "Library",
    icon: "/brand/icon-library.svg",
    iconClass: "h-[26px] w-[24px]",
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
          className="mt-[18px] ml-[32px] max-w-none flex-none justify-start"
          sideOffset={27}
          popupClassName="rounded-[15px] bg-transparent text-foreground shadow-[0px_3px_13px_0px_rgba(0,0,0,0.25)] ring-0"
        >
          <NavigationMenuList className="h-[57px] w-[589px] flex-none justify-start gap-0 overflow-hidden rounded-[4px] bg-white/20">
            <NavigationMenuItem className="h-full">
              <NavigationMenuTrigger className={cn(segmentClass, "pl-[23px]")}>
                <span className={segmentContentClass}>
                  <img
                    src="/brand/icon-guides.svg"
                    alt=""
                    className="h-[24px] w-[29px]"
                  />
                  Guides
                </span>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="h-[358px] w-[512px] p-0">
                <GuidesPanel />
              </NavigationMenuContent>
            </NavigationMenuItem>

            {sections.map((section) => (
              <NavigationMenuItem key={section.label} className="h-full">
                <NavigationMenuTrigger className={segmentClass}>
                  <span className={segmentContentClass}>
                    <img
                      src={section.icon}
                      alt=""
                      className={section.iconClass}
                    />
                    {section.label}
                  </span>
                </NavigationMenuTrigger>
                <NavigationMenuContent className="w-[320px] p-0">
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
          className="mt-[19px] ml-auto flex size-[49px] items-center justify-center rounded-[4px] bg-white/20 transition-colors hover:bg-white/30"
        >
          <img src="/brand/icon-search.svg" alt="" className="h-[22px] w-[22px]" />
        </button>
      </div>
    </header>
  )
}
