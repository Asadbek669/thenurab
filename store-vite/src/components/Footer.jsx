export default function Footer() {
  return (
    <footer id="footer" className="border-t border-stone-800 bg-[#24231f] text-stone-400">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 md:py-14 lg:px-8">
        <div>
          <h3 className="mb-3 text-lg font-black tracking-[0.12em] text-white">THENURAB</h3>
          <p className="max-w-sm text-sm leading-6 text-stone-400">
            Har kuningizga mos, sifatli va hamyonbop kiyimlar do‘koni. O‘z uslubingizni biz bilan toping.
          </p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Biz bilan bog‘laning</h4>
          <p className="text-sm">Telefon: +998 (90) 123-45-67</p>
          <p className="mt-2 text-sm">Telegram: @thenurab_store</p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Xizmat vaqti</h4>
          <p className="text-sm">Har kuni: 09:00 - 21:00</p>
          <p className="mt-2 text-sm text-[#c9a77d]">Onlayn buyurtmalar 24/7</p>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-stone-500">
        © 2026 THENURAB STORE. Barcha huquqlar himoyalangan.
      </div>
    </footer>
  );
}