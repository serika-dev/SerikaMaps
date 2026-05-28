"use client";

import Image from "next/image";

export default function Brand() {
  return (
    <div className="brand" id="brand">
      <Image
        src="/Logo.svg"
        alt="Serika Maps"
        width={140}
        height={34}
        style={{ width: "auto", height: "32px", objectFit: "contain" }}
        priority
      />
    </div>
  );
}
