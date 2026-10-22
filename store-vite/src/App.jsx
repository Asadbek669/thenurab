import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import Header from './components/Header';
import Banner from './components/Banner';
import Footer from './components/Footer';
import AdminPage from './components/AdminPage';
import ProfilePage from './components/ProfilePage';
import CartPage from './components/CartPage';
import ProductDetailPage from './components/ProductDetailPage';
import pb from './lib/pocketbase';
import { normalizeProductOptions } from './lib/productColors';
import { appHref, getAppPath } from './lib/routes';

const formatPrice = (price) => `${Number(price || 0).toLocaleString('uz-UZ')} so'm`;
const productPrice = (product) => {
  const price = Number(product.price || 0);
  const discounted = Number(product.discount_price || 0);
  return discounted > 0 && discounted < price ? discounted : price;
};

export default function App() {
  const path = getAppPath();
  if (path === '/admin') return <AdminPage />;
  if (path === '/profile') return <ProfilePage />;
  return <StorefrontRouter />;
}

function StorefrontRouter() {
  const [profile, setProfile] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem('thenurab-cart');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Saqlangan savatchani o‘qib bo‘lmadi:', error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('thenurab-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return undefined;

    let active = true;
    pb.send('/api/telegram/profile', {
      method: 'POST',
      body: { initData },
    })
      .then((result) => {
        if (active) setProfile(result.profile);
      })
      .catch((error) => {
        console.error('Telegram profilini olishda xatolik:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const path = getAppPath();
  const productRoute = path.match(/^\/product\/([^/]+)\/?$/);
  if (path === '/cart') return <CartPage cart={cart} setCart={setCart} profile={profile} />;
  if (productRoute) return <ProductDetailPage productId={decodeURIComponent(productRoute[1])} cartCount={cart.length} setCart={setCart} profile={profile} />;
  return <Storefront cart={cart} setCart={setCart} profile={profile} />;
}

function Storefront({ cart, setCart, profile }) {
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    pb.collection('products').getFullList()
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((error) => {
        if (active) {
          console.error('Mahsulotlarni olishda xatolik:', error);
          setLoadError("Mahsulotlarni yuklab bo'lmadi. Internet yoki server bilan aloqani tekshiring.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    pb.collection('banner')
      .getFullList({ filter: 'is_active = true', sort: '-created' })
      .then((banners) => {
        if (active) setBanners(banners);
      })
      .catch((error) => {
        console.error('Bannerlarni olishda xatolik:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((product) => product.title?.toLocaleLowerCase().includes(query));
  }, [products, search]);

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#24231f]">
      <Header cartCount={cart.length} profile={profile} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        {banners.length > 0 && <Banner banners={banners} />}

        <section id="products" className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby="products-heading">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8062]">Yangi mavsum tanlovi</p>
              <h2 id="products-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Barcha mahsulotlar</h2>
            </div>
            <label className="flex h-12 w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-stone-400 shadow-sm transition focus-within:border-[#9a8062] sm:max-w-xs">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mahsulot qidirish..."
                className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                aria-label="Mahsulot qidirish"
              />
            </label>
          </div>

          <div>
            <div>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="animate-pulse rounded-3xl bg-white p-3 shadow-sm sm:p-4">
                      <div className="aspect-[4/4.5] rounded-2xl bg-stone-100" />
                      <div className="mt-4 h-4 w-2/3 rounded bg-stone-100" />
                      <div className="mt-3 h-4 w-1/3 rounded bg-stone-100" />
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <div className="rounded-3xl border border-red-100 bg-white px-6 py-12 text-center">
                  <p className="font-semibold text-stone-800">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setLoadError('');
                      setReloadKey((key) => key + 1);
                    }}
                    className="mt-5 rounded-full bg-[#24231f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    Qayta urinish
                  </button>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="rounded-3xl border border-stone-200 bg-white px-6 py-14 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f0e9] text-[#9a8062]">
                    <ShoppingBag className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{search ? 'Mos mahsulot topilmadi' : 'Hozircha mahsulotlar yo‘q'}</h3>
                  <p className="mt-2 text-sm text-stone-500">
                    {search ? 'Boshqa nom bilan qidirib ko‘ring.' : 'Yangi mahsulotlar tez orada shu yerda bo‘ladi.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                  {visibleProducts.map((item) => {
                    const imageName = Array.isArray(item.images) ? item.images[0] : item.images;
                    const sizes = normalizeProductOptions(item.size);
                    const colors = normalizeProductOptions(item.color);
                    return (
                      <article key={item.id} className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-stone-100 bg-white p-2.5 shadow-[0_8px_30px_rgba(39,35,28,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(39,35,28,0.1)] sm:p-4">
                        <a href={appHref(`/product/${item.id}`)} aria-label={`${item.title} tafsilotlari`} className="relative block aspect-[4/4.5] overflow-hidden rounded-2xl bg-[#f1eee8]">
                          {imageName ? (
                            <img
                              src={pb.files.getURL(item, imageName)}
                              alt={item.title || 'Mahsulot rasmi'}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-400">
                              <ShoppingBag className="h-8 w-8" />
                              <span className="text-xs">Rasm mavjud emas</span>
                            </div>
                          )}
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600 backdrop-blur sm:left-3 sm:top-3 sm:text-xs">
                            Yangi
                          </span>
                        </a>
                        <div className="flex flex-1 flex-col px-0.5 pb-0.5 pt-3 sm:px-1 sm:pt-4">
                          <a href={appHref(`/product/${item.id}`)} className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-800 transition hover:text-[#8b6b48] sm:text-base">{item.title}</a>
                          <div className="mt-auto flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              {item.discount_price > 0 && item.discount_price < item.price && (
                                <p className="text-[10px] text-stone-400 line-through sm:text-xs">{formatPrice(item.price)}</p>
                              )}
                              <p className="text-sm font-bold text-[#8b6b48] sm:text-base">
                                {item.price ? formatPrice(productPrice(item)) : 'Narx so‘rov asosida'}
                              </p>
                            </div>
                            {sizes.length > 0 || colors.length > 0 ? (
                              <a href={appHref(`/product/${item.id}`)} aria-label={`${item.title} variantini tanlash`} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#24231f] px-3 text-xs font-semibold text-white transition hover:bg-[#8b6b48] sm:w-auto sm:text-sm">
                                <Plus className="h-4 w-4" />
                                <span>Tanlash</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCart((current) => [...current, item])}
                                disabled={item.in_stock === false}
                                aria-label={`${item.title} savatchaga qo'shish`}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#24231f] px-3 text-xs font-semibold text-white transition hover:bg-[#8b6b48] disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto sm:text-sm"
                              >
                                <Plus className="h-4 w-4" />
                                <span className="sm:hidden">{item.in_stock === false ? 'Tugagan' : 'Savatchaga'}</span>
                                <span className="hidden sm:inline">{item.in_stock === false ? 'Tugagan' : 'Qo‘shish'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
