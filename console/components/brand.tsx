import Image from "next/image"

// Brand mark: the tako icon. Used where space is tight (sidebar, collapsed
// rails). The full lockup lives in BrandLockup.
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/tako.png"
      alt=""
      width={36}
      height={36}
      className={className ??"size-9 rounded-md object-contain"}
    />
  )
}

// Full lockup (icon + wordmark) downloaded from the marketing site.
export function BrandLockup({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="tako"
      width={150}
      height={50}
      unoptimized
      className={className ??"h-10 w-auto"}
    />
  )
}
