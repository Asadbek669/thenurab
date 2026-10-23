import { ArrowLeft, ArrowRight, CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import api from '../lib/api';
import { colorDetails } from '../lib/productColors';
import { appHref } from '../lib/routes';

const formatPrice = (price) => `${Number(price || 0).toLocaleString('uz-UZ')} so'm`;
const productPrice = (product) => {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);
  return discount > 0 && discount < price ? discount : price;
};
const cartSize = (product) => product.selectedSize
  || (Array.isArray(product.size) ? product.size.join(', ') : product.size || '');
const cartColor = (product) => product.selectedColor
  || (Array.isArray(product.color) ? '' : product.color || '');

export default function CartPage({ cart, setCart, profile }) {
  const [phone, setPhone] = useState(null);
  const [address, setAddress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderNotice, setOrderNotice] = useState('');
  const phoneValue = phone ?? profile?.phone ?? '';
  const addressValue = address ?? profile?.address ?? '';
  const grouped = cart.reduce((groups, product) => {
    const existing = groups.find((item) => item.product.id === product.id
      && cartSize(item.product) === cartSize(product)
      && cartColor(item.product) === cartColor(product));
    if (existing) existing.quantity += 1;
    else groups.push({ product, quantity: 1 });
    return groups;
  }, []);
  const totalItems = cart.length;
  const totalPrice = cart.reduce((sum, product) => sum + productPrice(product), 0);
  const changeQuantity = (product, delta) => {
    if (delta > 0) {
      setCart((current) => [...current, product]);
      return;
    }
    setCart((current) => {
      const index = current.findIndex((item) => item.id === product.id
        && cartSize(item) === cartSize(product)
        && cartColor(item) === cartColor(product));
      return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
    });
  };
  const placeOrder = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setOrderError('');
    setOrderNotice('');
    const initData = window.Telegram?.WebApp?.initData || '';
    if (!initData) {
      setOrderError('Buyurtma uchun Telegram bot ichidan do‘konni oching.');
      setSubmitting(false);
      return;
    }
    try {
      const result = await api.send('/api/orders', {
        method: 'POST',
        body: {
          initData,
          phone: phoneValue.trim(),
          address: addressValue.trim(),
          items: grouped.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
            size: product.selectedSize || '',
            color: product.selectedColor || '',
          })),
        },
      });
      setCart([]);
      setOrderNotice(result.warning
        ? `Buyurtma #${result.order.id.slice(-6)} saqlandi. ${result.warning}`
        : `Buyurtmangiz #${result.order.id.slice(-6)} qabul qilindi. Tez orada siz bilan bog‘lanamiz.`);
    } catch (requestError) {
      console.error('Buyurtmani yuborishda xatolik:', requestError);
      setOrderError(requestError?.response?.message || 'Buyurtmani yuborib bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f4] text-[#24231f]">
      <Header cartCount={totalItems} profile={profile} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <a href={appHref()} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-[#8b6b48]">
          <ArrowLeft className="h-4 w-4" /> Xaridni davom ettirish
        </a>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a8062]">Tanlangan mahsulotlar</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Savatcha</h1>
          </div>
          <p className="text-sm text-stone-500">{totalItems} ta mahsulot</p>
        </div>
        {orderNotice && <p role="status" className="mt-5 flex gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />{orderNotice}</p>}

        {grouped.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-stone-200 bg-white px-5 py-16 text-center shadow-sm">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f0e9] text-[#8b6b48]"><ShoppingBag className="h-7 w-7" /></span>
            <h2 className="mt-5 text-xl font-bold">Savatchangiz bo‘sh</h2>
            <p className="mt-2 text-sm text-stone-500">Yoqtirgan mahsulotlaringizni tanlab, shu yerda jamlang.</p>
            <a href={appHref()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#24231f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8b6b48]">
              Mahsulotlarni ko‘rish <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              {grouped.map(({ product, quantity }) => {
                const image = Array.isArray(product.images) ? product.images[0] : product.images;
                const chosenSize = cartSize(product);
                const chosenColor = cartColor(product);
                const color = chosenColor ? colorDetails(chosenColor) : null;
                return (
                  <article key={`${product.id}-${chosenSize}-${chosenColor}`} className="flex gap-3 border-b border-stone-100 p-4 last:border-b-0 sm:gap-5 sm:p-5">
                    <a href={appHref(`/product/${product.id}`)} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#f1eee8] sm:h-32 sm:w-32">
                      {image ? <img src={api.files.getURL(product, image)} alt={product.title} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-stone-400">Rasm yo‘q</span>}
                    </a>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <a href={appHref(`/product/${product.id}`)} className="line-clamp-2 text-sm font-bold text-stone-800 hover:text-[#8b6b48] sm:text-base">{product.title}</a>
                        <p className="mt-1 text-sm font-semibold text-[#8b6b48]">{formatPrice(productPrice(product))}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {color && <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                            <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: color.hex }} />
                            {color.name} {color.hex}
                          </span>}
                          {chosenSize && <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">{chosenSize}</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="flex h-9 items-center rounded-xl border border-stone-200">
                          <button type="button" onClick={() => changeQuantity(product, -1)} aria-label={`${product.title} sonini kamaytirish`} className="flex h-9 w-9 items-center justify-center text-stone-500 hover:text-stone-900"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="min-w-7 text-center text-sm font-semibold">{quantity}</span>
                          <button type="button" disabled={product.in_stock === false} onClick={() => changeQuantity(product, 1)} aria-label={`${product.title} sonini oshirish`} className="flex h-9 w-9 items-center justify-center text-stone-500 hover:text-stone-900 disabled:text-stone-300"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <button type="button" onClick={() => setCart((current) => current.filter((item) => item.id !== product.id || cartSize(item) !== chosenSize || cartColor(item) !== chosenColor))} aria-label={`${product.title}${chosenSize ? ` (${chosenSize})` : ''}${color ? ` (${color.name})` : ''}ni savatchadan o‘chirish`} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-bold">Buyurtma xulosasi</h2>
              <div className="mt-5 flex justify-between text-sm text-stone-500"><span>Mahsulotlar ({totalItems} ta)</span><span>{formatPrice(totalPrice)}</span></div>
              <div className="mt-3 flex justify-between border-t border-stone-100 pt-4 text-base font-bold"><span>Jami</span><span className="text-[#8b6b48]">{formatPrice(totalPrice)}</span></div>
              <form onSubmit={placeOrder} className="mt-5 space-y-3">
                <label className="block text-xs font-semibold text-stone-600">
                  Telefon raqami
                  <input required type="tel" value={phoneValue} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#9a8062]" />
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Yetkazib berish manzili
                  <textarea required minLength={5} maxLength={500} rows="3" value={addressValue} onChange={(event) => setAddress(event.target.value)} placeholder="Shahar, ko‘cha, uy va xonadon" className="mt-1.5 w-full resize-y rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#9a8062]" />
                </label>
                {orderError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{orderError}</p>}
                {orderNotice && <p role="status" className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{orderNotice}</p>}
                <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#24231f] text-sm font-bold text-white transition hover:bg-[#8b6b48] disabled:cursor-wait disabled:opacity-60">
                  {submitting ? 'Yuborilmoqda...' : 'Buyurtma berish'} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-center text-xs leading-5 text-stone-400">Buyurtma maʼlumotlari admin panelga saqlanib, Telegram guruhiga yuboriladi.</p>
              </form>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
