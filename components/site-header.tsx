"use client"

import { useState } from "react"

import {
  ArrowUpRight,
  BookOpenText,
  Lightbulb,
  MagnifyingGlass,
  Package,
  Wrench,
  type Icon,
} from "@phosphor-icons/react"
import { AnimatePresence, motion, useMotionValue } from "motion/react"
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

/* Optional artwork layer for the Start here! card — drop a webp in
   public/brand and point this at it. It sits between the checkerboard and
   the text, and scales up while the card is hovered. */
const CARD_FG_SRC: string | null = null

function GuidesPanel() {
  const [cardHover, setCardHover] = useState(false)
  /* Raw motion values, no spring — the pill tracks the cursor 1:1. Only the
     enter/exit fade+scale is sprung. */
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)

  /* Pill coordinates are relative to the panel wrapper; the pill floats to
     the top-right of the cursor. */
  const placePill = (e: React.MouseEvent<HTMLElement>) => {
    const wrap = e.currentTarget.parentElement
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    cursorX.set(e.clientX - wr.left + 16)
    cursorY.set(e.clientY - wr.top - 40)
  }

  return (
    <div className="relative flex h-full w-full pt-[13px] pr-[12px] pb-[12px] pl-[14px] [perspective:900px]">
        {/* Start here! card — layers: checker bg, artwork, text, corner tab.
            Pointer-tracking tilt: mousemove writes the rotation directly so
            there is no re-render; the transform transition smooths it out. */}
        <NavigationMenuLink
          href="#"
          className="group/card relative block h-[302px] w-[244px] shrink-0 overflow-hidden rounded-[7px] border-[3px] border-solid border-[#ff902f] p-0 transition-[transform,box-shadow] duration-200 ease-out will-change-transform hover:bg-transparent hover:shadow-[0px_14px_28px_rgba(0,0,0,0.28)] focus:bg-transparent"
          onMouseEnter={(e) => {
            placePill(e)
            setCardHover(true)
          }}
          onMouseMove={(e) => {
            const el = e.currentTarget
            const r = el.getBoundingClientRect()
            const x = (e.clientX - r.left) / r.width - 0.5
            const y = (e.clientY - r.top) / r.height - 0.5
            el.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) scale(1.02)`
            // the light sweep rides the tilt: same pointer position drives it
            el.style.setProperty("--sweep", (x + 0.5).toFixed(3))
            placePill(e)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = ""
            e.currentTarget.style.removeProperty("--sweep")
            setCardHover(false)
          }}
        >
          {/* background: checkerboard + sunlight gradient.
              Values sampled from the Figma render: base squares #FFBA01/#FF9D00
              (~54px at this scale), washed toward rgba(255,211,1,.75) at the
              top-right so the checker contrast fades out there. */}
          <div
            aria-hidden
            className="absolute -inset-[60%] rotate-[-8.66deg]"
            style={{
              backgroundImage:
                "conic-gradient(#FFBA01 0 25%, #FF9D00 0 50%, #FFBA01 0 75%, #FF9D00 0)",
              backgroundSize: "107px 107px",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(67.21deg, rgba(255,211,1,0) 0%, rgba(255,211,1,0.75) 100%)",
            }}
          />

          {/* foreground artwork — scales up on hover */}
          {CARD_FG_SRC && (
            <img
              src={CARD_FG_SRC}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.06]"
            />
          )}

          {/* text layer — the Figma-exported vector overlay (305x377, scales
              to the card), outlines and shadows baked in */}
          <img
            src="/brand/cardtext.svg"
            alt="beginner? Start here!"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

          {/* soft light sweep — its position is driven by the same pointer
              value as the tilt (--sweep, 0..1), so the sheen glides across
              the card as it tilts */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          >
            <div className="absolute -top-[30%] -bottom-[30%] -left-[55%] w-[55%] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.32)_50%,rgba(255,255,255,0)_100%)] transition-transform duration-200 ease-out [transform:translateX(calc(var(--sweep,0.5)*300%))_rotate(20deg)]" />
          </div>

          {/* Zero To One corner tab — the Figma flag vector as a clip-path,
              built at design scale (173x34) and scaled 0.8 from the top-right
              so it sits flush with the card's corner radius. */}
          <span
            className="absolute -top-[3px] -right-[3px] flex h-[34px] w-[173px] origin-top-right scale-[0.8] items-center justify-end gap-[6px] bg-[#ff902f] pr-[20px] text-[16px] font-semibold tracking-[-0.03em] text-white"
            style={{
              clipPath:
                "path('M22.3123 26.1852L11.8664 7.04281C9.49719 2.70115 4.94603 0 0 0H165C169.418 0 173 3.58172 173 8V34H35.4794C29.9913 34 24.9412 31.0028 22.3123 26.1852Z')",
            }}
          >
            Zero To One
            <ArrowUpRight size={15} weight="bold" aria-hidden />
          </span>
        </NavigationMenuLink>

        {/* cursor pill — springs in at the top-right of the pointer */}
        <AnimatePresence>
          {cardHover && (
            <motion.span
              className="pointer-events-none absolute top-0 left-0 z-30 flex h-[32px] items-center gap-[6px] rounded-[16px] rounded-bl-[5.4px] bg-black px-[15px] text-[14px] font-semibold tracking-[-0.03em] whitespace-nowrap text-white"
              style={{ x: cursorX, y: cursorY, transformOrigin: "left bottom" }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.55 }}
              transition={{ type: "spring", stiffness: 550, damping: 30 }}
            >
              Start Here
              <ArrowUpRight size={15} weight="bold" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>

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
      { title: "Electricity Basics", description: "Voltage, current, resistance" },
      { title: "Components", description: "Resistors, LEDs, capacitors, switches" },
      { title: "Microcontrollers", description: "What they are, how they think" },
      { title: "PCBs", description: "From breadboard to printed board" },
    ],
  },
  {
    label: "Tools",
    icon: Wrench,
    iconSize: 24,
    footer: "Check out all tools",
    items: [
      { title: "Soldering Iron", description: "First hour, technique, safety" },
      { title: "Multimeter", description: "Measuring without guessing" },
      { title: "Debugging Hardware", description: "When nothing works" },
    ],
  },
  {
    label: "Library",
    icon: Package,
    iconSize: 26,
    footer: "Check out the full library",
    items: [
      { title: "Adafruit Guides", description: "3000+ imported guides" },
      { title: "Codex", description: "Hack Club's hardware reference" },
      { title: "Datasheets 101", description: "How to actually read them" },
      { title: "Recommended Parts & Kits", description: "What to buy" },
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
