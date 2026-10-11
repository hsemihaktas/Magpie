import Image from "next/image";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-4">
        <Image
          src="/logo-96.png"
          alt="Magpie"
          width={48}
          height={48}
          className="mx-auto opacity-60 animate-pulse"
          priority
        />
        <div className="w-8 h-8 border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 animate-spin mx-auto" />
        <p className="mono text-zinc-400 text-xs">YÜKLENİYOR</p>
      </div>
    </div>
  );
}
