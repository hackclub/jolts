"use client"

import { useCurator } from "@/components/review/gate"

/* Who is reviewing, for the queue header. A client component because the
   curator only exists on the client - the page shell is static. */

export function CuratorBadge() {
  const user = useCurator()
  return (
    <p className="hidden shrink-0 items-center gap-[7px] text-[12.5px] text-[#9aa1ab] sm:flex">
      {user.avatarUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={user.avatarUrl}
          alt=""
          width={22}
          height={22}
          className="size-[22px] rounded-full bg-[#f3f3f3]"
        />
      )}
      @{user.login}
    </p>
  )
}
