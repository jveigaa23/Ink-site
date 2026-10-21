import Image from "next/image";
import Link from "next/link";
import type { MediaRef } from "@/config/settings-schema";

export function Brand({ name, logo }: { name: string; logo: MediaRef | null }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label={`${name} — página inicial`}>
      {logo ? (
        <Image src={logo.url} alt="" width={logo.width} height={logo.height} className="h-9 w-auto" priority />
      ) : (
        <span className="display text-2xl leading-none text-bone transition-colors group-hover:text-bone-dim sm:text-[1.7rem]">
          {name}
        </span>
      )}
    </Link>
  );
}
