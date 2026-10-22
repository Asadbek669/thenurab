import { ShoppingBag } from 'lucide-react';

export default function Header({ cartCount, profile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f8f7f4]/95 backdrop-blur-xl">
      <div className="bg-[#24231f] px-4 py-2 text-center text-[10px] font-medium tracking-wide text-white sm:text-xs">
        Barcha buyurtmalarga yetkazib berish xizmati mavjud
      </div>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <a href="#" className="group flex items-center gap-2.5" aria-label="Thenurab Store bosh sahifa">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#24231f] text-sm font-black tracking-tight text-white transition group-hover:bg-[#8b6b48] sm:h-11 sm:w-11">T</span>
          <span>
            <span className="block text-base font-black leading-4 tracking-[0.12em] text-[#24231f] sm:text-lg">THENURAB</span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.28em] text-[#9a8062]">Everyday style</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
          <a href="#categories-heading" className="transition hover:text-[#8b6b48]">Kategoriyalar</a>
          <a href="#products" className="transition hover:text-[#8b6b48]">Mahsulotlar</a>
          <a href="#footer" className="transition hover:text-[#8b6b48]">Biz haqimizda</a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/profile"
            aria-label={profile?.name ? `Profil: ${profile.name}` : 'Profil sahifasi'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e7dac8] text-sm font-bold uppercase text-[#5e4831] ring-2 ring-white transition hover:bg-[#d6c2a8] sm:h-11 sm:w-11"
          >
            {profile?.name?.trim()?.charAt(0) || 'T'}
          </a>
          <a
            href="/cart"
            className="relative flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-[#b7a087] hover:text-[#8b6b48] sm:px-4"
            aria-label={`Savatcha, ${cartCount} ta mahsulot`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Savatcha</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#24231f] px-1 text-[10px] font-bold text-white">{cartCount}</span>
          </a>
        </div>
      </div>
    </header>
  );
}