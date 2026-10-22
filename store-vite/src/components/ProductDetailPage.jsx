import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus, ShoppingBag } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import pb from '../lib/pocketbase';
import { colorDetails, normalizeProductOptions } from '../lib/productColors';
import { appHref } from '../lib/routes';

const formatPrice = (price) => `${Number(price || 0).toLocaleString('uz-UZ')} so'm`;
const productPrice = (product) => {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);
  return discount > 0 && discount < price ? discount : price;
};

export default function ProductDetailPage({ productId, cartCount, setCart, profile }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  useEffect(() => {
    let active = true;
    pb.collection('products').getOne(productId)
      .then((record) => {
        if (active) {
          setProduct(record);
          setSelectedSize('');
          setSelectedColor('');
          setImageIndex(0);
        }
      })
      .catch((requestError) => {
        console.error('Mahsulot tafsilotlarini yuklashda xatolik:', requestError);
        if (active) {
          setBackendUnavailable(requestError?.status === 0);
          setError(requestError?.response?.message || 'Mahsulotni topib bo‘lmadi.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const images = product ? (Array.isArray(product.images) ? product.images : product.images ? [product.images] : []) : [];
  const sizes = product ? normalizeProductOptions(product.size) : [];
  const colors = product ? normalizeProductOptions(product.color) : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f4] text-[#24231f]">
      <Header cartCount={cartCount} profile={profile} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <a href={appHref()} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-[#8b6b48]"><ArrowLeft className="h-4 w-4" /> Mahsulotlarga qaytish</a>
        {loading ? <ProductDetailSkeleton />
          : error ? <>{backendUnavailable && <ProductDetailSkeleton />}<div role="alert" className="mt-8 rounded-3xl border border-red-100 bg-white p-5 text-center text-sm text-red-700">{error}</div></>
            : product && (
              <section className="mt-6 grid gap-7 lg:grid-cols-2 lg:gap-12">
                <div>
                  <div className="aspect-square overflow-hidden rounded-3xl bg-[#f1eee8]">
                    {images[imageIndex] ? <img src={pb.files.getURL(product, images[imageIndex])} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-stone-400"><ShoppingBag className="h-10 w-10" /><span className="text-sm">Rasm mavjud emas</span></div>}
                  </div>
                  {images.length > 1 && <div className="mt-3 flex gap-3 overflow-x-auto">{images.map((image, index) => <button key={image} type="button" onClick={() => setImageIndex(index)} aria-label={`Mahsulot rasmi ${index + 1}`} aria-pressed={imageIndex === index} className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${imageIndex === index ? 'border-[#8b6b48]' : 'border-transparent'}`}><img src={pb.files.getURL(product, image, { thumb: '100x100' })} alt={`${product.title} rasmi ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}
                </div>
                <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a8062]">{product.category || 'THENURAB kolleksiyasi'}</p>
                  <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{product.title}</h1>
                  <div className="mt-5 flex flex-wrap items-baseline gap-3">
                    <p className="text-2xl font-bold text-[#8b6b48]">{product.price ? formatPrice(productPrice(product)) : 'Narx so‘rov asosida'}</p>
                    {product.discount_price > 0 && product.discount_price < product.price && <p className="text-sm text-stone-400 line-through">{formatPrice(product.price)}</p>}
                  </div>
                  {product.description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-stone-600">{product.description}</p>}
                  <div className="mt-7 grid grid-cols-2 gap-3">
                    {colors.length > 0 && <div className="col-span-2 rounded-xl bg-[#f8f7f4] p-4">
                      <p className="text-xs text-stone-500">Rangni tanlang</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {colors.map((color) => {
                          const { name, hex } = colorDetails(color);
                          const selected = selectedColor === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              aria-label={`${name}, ${hex}`}
                              aria-pressed={selected}
                              onClick={() => setSelectedColor(color)}
                              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 transition ${selected ? 'border-[#8b6b48] bg-white ring-2 ring-[#8b6b48]/20' : 'border-transparent bg-white/60 hover:border-stone-300'}`}
                            >
                              <span className="h-8 w-8 rounded-full border border-black/15" style={{ backgroundColor: hex }} />
                              <span className="text-left">
                                <span className="block text-xs font-semibold">{name}</span>
                                <span className="block text-[10px] text-stone-500">{hex}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>}
                    {sizes.length > 0 && <div className="col-span-2 rounded-xl bg-[#f8f7f4] p-4">
                      <p className="text-xs text-stone-500">O‘lchamni tanlang</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sizes.map((size) => <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`h-10 min-w-11 rounded-xl border px-3 text-sm font-semibold transition ${selectedSize === size ? 'border-[#8b6b48] bg-[#8b6b48] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-[#9a8062]'}`}>{size}</button>)}
                      </div>
                    </div>}
                    <div className="col-span-2 rounded-xl bg-[#f8f7f4] p-3"><p className="text-xs text-stone-500">Mavjudligi</p><p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${product.in_stock === false ? 'text-red-600' : 'text-emerald-700'}`}>{product.in_stock === false ? 'Hozircha tugagan' : <><Check className="h-4 w-4" /> Mavjud</>}</p></div>
                  </div>
                  <button
                    type="button"
                    disabled={product.in_stock === false || (sizes.length > 0 && !selectedSize) || (colors.length > 0 && !selectedColor)}
                    onClick={() => {
                      setCart((current) => [...current, { ...product, selectedSize, selectedColor }]);
                      setAdded(true);
                    }}
                    className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#24231f] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#8b6b48] disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    <Plus className="h-4 w-4" /> {product.in_stock === false ? 'Mahsulot tugagan' : colors.length > 0 && !selectedColor ? 'Rangni tanlang' : sizes.length > 0 && !selectedSize ? 'O‘lchamni tanlang' : added ? 'Yana savatchaga qo‘shish' : 'Savatchaga qo‘shish'}
                  </button>
                  {added && <a href={appHref('/cart')} className="mt-3 block text-center text-sm font-semibold text-[#8b6b48] hover:underline">Savatchaga o‘tish ({cartCount})</a>}
                </div>
              </section>
            )}
      </main>
      <Footer />
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div aria-label="Mahsulot ma’lumotlari yuklanmoqda" aria-busy="true" className="mt-8 grid gap-7 lg:grid-cols-2 lg:gap-12">
      <div>
        <div className="skeleton-shimmer aspect-square rounded-3xl" />
        <div className="mt-3 flex gap-3">
          {[1, 2, 3].map((item) => <div key={item} className="skeleton-shimmer h-20 w-20 shrink-0 rounded-xl" />)}
        </div>
      </div>
      <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-8 lg:p-10">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
        <div className="skeleton-shimmer mt-4 h-9 w-3/4 rounded-lg" />
        <div className="skeleton-shimmer mt-6 h-7 w-36 rounded" />
        <div className="mt-7 space-y-2">
          <div className="skeleton-shimmer h-3 w-full rounded" />
          <div className="skeleton-shimmer h-3 w-5/6 rounded" />
          <div className="skeleton-shimmer h-3 w-2/3 rounded" />
        </div>
        <div className="skeleton-shimmer mt-8 h-24 w-full rounded-xl" />
        <div className="skeleton-shimmer mt-4 h-20 w-full rounded-xl" />
        <div className="skeleton-shimmer mt-7 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
