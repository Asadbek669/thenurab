import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes, Image, LayoutDashboard, Package, Pencil, Plus, RefreshCw,
  Search, ShoppingCart, Trash2, Users, X,
} from 'lucide-react';
import api from '../lib/api';
import prepareImage from '../lib/prepareImage';
import { colorDetails, normalizeProductOptions, productColors } from '../lib/productColors';
import { appHref, resolveAppLink } from '../lib/routes';

const sections = [
  { id: 'overview', label: 'Umumiy', icon: LayoutDashboard },
  { id: 'products', label: 'Mahsulotlar', icon: Package },
  { id: 'banners', label: 'Bannerlar', icon: Image },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingCart },
  { id: 'users', label: 'Foydalanuvchilar', icon: Users },
];

const money = (value) => `${Number(value || 0).toLocaleString('uz-UZ')} so'm`;
const date = (value) => value ? new Date(value).toLocaleDateString('uz-UZ') : '—';
const blankProduct = {
  title: '', price: '', discount_price: '', description: '', color: '',
  size: [], category: '', in_stock: true,
};
const blankBanner = { title: '', url: '', is_active: true };
const productSizes = ['S', 'M', 'L', 'XL', 'XXL'];

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState('overview');
  const [data, setData] = useState({ products: [], banners: [], orders: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);

  const fetchData = () => Promise.all([
    api.collection('products').getFullList({ sort: '-created' }),
    api.collection('banner').getFullList({ sort: '-created' }),
    api.collection('orders').getFullList({ sort: '-created' }),
    api.collection('user').getFullList({ sort: '-created' }),
  ]);

  const handleRequestError = (requestError, fallbackMessage) => {
    console.error(fallbackMessage, requestError);
    if (requestError?.status === 401 || requestError?.status === 403) {
      setAuthorized(false);
    }
    setError(requestError?.response?.message || fallbackMessage);
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }
    try {
      const [products, banners, orders, users] = await fetchData();
      setData({ products, banners, orders, users });
    } catch (requestError) {
      handleRequestError(requestError, "Ma'lumotlarni yuklab bo'lmadi. API server va ruxsatlarni tekshiring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.admin.getSession()
      .then(() => {
        if (active) setAuthorized(true);
      })
      .catch((requestError) => {
        if (requestError?.status !== 401) {
          console.error('Admin sessiyasini tekshirishda xatolik:', requestError);
          if (active) setError(requestError?.response?.message || 'Admin sessiyasini tekshirib bo‘lmadi.');
        }
        if (active) setAuthorized(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authorized) return undefined;

    let active = true;
    fetchData()
      .then(([products, banners, orders, users]) => {
        if (active) setData({ products, banners, orders, users });
      })
      .catch((requestError) => {
        if (active) handleRequestError(requestError, "Ma'lumotlarni yuklab bo'lmadi. API server va ruxsatlarni tekshiring.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authorized]);

  const login = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.admin.login(email, password);
      setAuthorized(true);
    } catch (loginError) {
      console.error('Admin tizimiga kirishda xatolik:', loginError);
      setError(loginError?.response?.message || "Email yoki parol noto'g'ri.");
    } finally {
      setLoading(false);
    }
  };

  const saveRecord = async (collection, id, values) => {
    setError('');
    setNotice('');
    try {
      if (id) await api.collection(collection).update(id, values);
      else await api.collection(collection).create(values);
      setEditor(null);
      setNotice(id ? 'O‘zgarishlar saqlandi.' : 'Yangi maʼlumot qo‘shildi.');
      await loadData(false);
    } catch (saveError) {
      console.error('Maʼlumotni saqlashda xatolik:', saveError);
      setError(saveError?.response?.message || "Saqlash amalga oshmadi. Maydonlarni tekshirib qayta urinib ko'ring.");
      throw saveError;
    }
  };

  const deleteRecord = async (collection, id) => {
    if (!window.confirm("Ushbu yozuvni o'chirishni tasdiqlaysizmi?")) return;
    setError('');
    setNotice('');
    try {
      await api.collection(collection).delete(id);
      setNotice("Yozuv o'chirildi.");
      await loadData(false);
    } catch (deleteError) {
      console.error('Yozuvni o‘chirishda xatolik:', deleteError);
      setError(deleteError?.response?.message || "O'chirish amalga oshmadi.");
    }
  };

  const searchableData = useMemo(() => {
    const list = section === 'products' ? data.products
      : section === 'banners' ? data.banners
        : section === 'orders' ? data.orders : data.users;
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return list;
    return list.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(normalized));
  }, [data, query, section]);

  if (authorized === null) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f2ed] px-4 text-sm text-stone-500">Admin sessiyasi tekshirilmoqda...</main>;
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f2ed] px-4 py-10">
        <form onSubmit={login} className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_24px_70px_rgba(39,35,28,0.1)] sm:p-9">
          <a href={appHref()} className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#24231f] font-black text-white">T</span>
            <span className="text-sm font-black tracking-[0.14em]">THENURAB <span className="text-[#9a8062]">ADMIN</span></span>
          </a>
          <h1 className="mt-8 text-2xl font-bold">Admin panelga kirish</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">Admin email va parolingizni kiriting.</p>
          <label className="mt-7 block text-sm font-semibold text-stone-700">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#9a8062]"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-stone-700">
            Parol
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#9a8062]"
            />
          </label>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#24231f] text-sm font-bold text-white transition hover:bg-[#8b6b48] disabled:opacity-60">
            {loading ? 'Tekshirilmoqda...' : 'Xavfsiz kirish'}
          </button>
          <a href={appHref()} className="mt-5 block text-center text-sm font-medium text-stone-500 hover:text-stone-900">Do‘konga qaytish</a>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-stone-900 lg:flex">
      <aside className="bg-[#24231f] px-4 py-4 text-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:px-5 lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <a href={appHref()} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b6b48] font-black">T</span>
            <span><span className="block text-sm font-black tracking-[0.13em]">THENURAB</span><span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Admin panel</span></span>
          </a>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto lg:mt-12 lg:flex-col">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => { setSection(id); setQuery(''); setNotice(''); setError(''); }}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${section === id ? 'bg-[#8b6b48] text-white' : 'text-stone-400 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon className="h-[18px] w-[18px]" />{label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:ml-64 lg:px-10 lg:py-9">
        <header className="mb-7 flex items-start justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a8062]">THENURAB STORE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{sections.find((item) => item.id === section)?.label}</h1>
          </div>
          <button type="button" onClick={loadData} aria-label="Yangilash" className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </header>

        {error && <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Xabarni yopish"><X className="h-4 w-4" /></button></div>}
        {notice && <div role="status" className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {section === 'overview' ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Mahsulotlar', value: data.products.length, icon: Package },
              { label: 'Bannerlar', value: data.banners.length, icon: Image },
              { label: 'Buyurtmalar', value: data.orders.length, icon: ShoppingCart },
              { label: 'Foydalanuvchilar', value: data.users.length, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-stone-500">{label}</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0e9] text-[#8b6b48]"><Icon className="h-5 w-5" /></span></div>
                <p className="mt-5 text-3xl font-bold">{loading ? '…' : value}</p>
                <button type="button" onClick={() => setSection(label === 'Mahsulotlar' ? 'products' : label === 'Bannerlar' ? 'banners' : label === 'Buyurtmalar' ? 'orders' : 'users')} className="mt-3 text-xs font-semibold text-[#8b6b48] hover:underline">Boshqarish →</button>
              </article>
            ))}
            <article className="rounded-2xl border border-stone-200 bg-white p-5 sm:col-span-2 xl:col-span-4">
              <div className="flex items-center gap-3"><Boxes className="h-5 w-5 text-[#8b6b48]" /><h2 className="font-bold">Boshqaruv paneli</h2></div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Mahsulot va bannerlarni yangilang, buyurtmalar holatini ko‘ring hamda Telegram orqali ro‘yxatdan o‘tgan foydalanuvchilar maʼlumotlarini tekshiring.</p>
            </article>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-stone-200 px-3 text-stone-400 sm:max-w-xs">
                <Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Qidirish..." className="w-full bg-transparent text-sm text-stone-800 outline-none" />
              </div>
              {(section === 'products' || section === 'banners') && (
                <button type="button" onClick={() => setEditor({ kind: section === 'products' ? 'product' : 'banner', record: null })} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#24231f] px-4 text-sm font-bold text-white transition hover:bg-[#8b6b48]">
                  <Plus className="h-4 w-4" />{section === 'products' ? 'Mahsulot qo‘shish' : 'Banner qo‘shish'}
                </button>
              )}
            </div>

            {loading ? <div className="p-10 text-center text-sm text-stone-500">Maʼlumotlar yuklanmoqda...</div>
              : section === 'products' ? (
                <div className="divide-y divide-stone-100">
                  {searchableData.map((product) => {
                    const image = Array.isArray(product.images) ? product.images[0] : product.images;
                    return <div key={product.id} className="flex items-center gap-3 p-4 sm:gap-4 sm:px-5">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">{image && <img src={api.files.getURL(product, image)} alt="" className="h-full w-full object-cover" />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.title || 'Nomsiz mahsulot'}</p><p className="mt-1 text-xs text-stone-500">{money(product.discount_price || product.price)}{product.category ? ` · ${product.category}` : ''} · {product.in_stock === false ? 'Tugagan' : 'Mavjud'}</p></div>
                      <RecordActions onEdit={() => setEditor({ kind: 'product', record: product })} onDelete={() => deleteRecord('products', product.id)} />
                    </div>;
                  })}
                  {!searchableData.length && <EmptyState label="Mahsulot topilmadi." />}
                </div>
              ) : section === 'banners' ? (
                <div className="divide-y divide-stone-100">
                  {searchableData.map((banner) => <div key={banner.id} className="flex items-center gap-3 p-4 sm:gap-4 sm:px-5">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">{banner.image && <img src={api.files.getURL(banner, banner.image)} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{banner.title || 'Nomsiz banner'}</p><p className="mt-1 text-xs text-stone-500">{banner.is_active ? 'Faol' : 'Faol emas'}{banner.url ? ` · ${banner.url}` : ''}</p></div>
                    <RecordActions onEdit={() => setEditor({ kind: 'banner', record: banner })} onDelete={() => deleteRecord('banner', banner.id)} />
                  </div>)}
                  {!searchableData.length && <EmptyState label="Banner topilmadi." />}
                </div>
              ) : section === 'users' ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Foydalanuvchi</th><th className="px-5 py-3">Telegram ID</th><th className="px-5 py-3">Telefon</th><th className="px-5 py-3">Manzil</th><th className="px-5 py-3">Sana</th></tr></thead>
                    <tbody className="divide-y divide-stone-100">{searchableData.map((user) => <tr key={user.id}>
                      <td className="px-5 py-4"><p className="font-semibold">{user.name || 'Ism kiritilmagan'}</p><p className="mt-1 text-xs text-stone-500">{user.telegram_username ? `@${user.telegram_username}` : 'Telegram username yo‘q'}</p></td>
                      <td className="px-5 py-4 text-stone-600">{user.telegram_id || '—'}</td><td className="px-5 py-4 text-stone-600">{user.phone || '—'}</td><td className="max-w-[240px] truncate px-5 py-4 text-stone-600">{user.address || '—'}</td><td className="px-5 py-4 text-stone-500">{date(user.created)}</td>
                    </tr>)}</tbody>
                  </table>
                  {!searchableData.length && <EmptyState label="Foydalanuvchilar topilmadi." />}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Buyurtma</th><th className="px-5 py-3">Foydalanuvchi</th><th className="px-5 py-3">Telefon / manzil</th><th className="px-5 py-3">Mahsulotlar</th><th className="px-5 py-3">Jami</th><th className="px-5 py-3">Holat</th><th className="px-5 py-3">Telegram</th></tr></thead>
                    <tbody className="divide-y divide-stone-100">{searchableData.map((order) => {
                      const customer = data.users.find((user) => user.id === order.user || user.telegram_id === order.user);
                      const itemNames = Array.isArray(order.items)
                        ? order.items.map((item) => {
                          if (typeof item === 'string') return item;
                          const title = item?.title || item?.name || item?.product || 'Mahsulot';
                          const quantity = item?.quantity ? ` × ${item.quantity}` : '';
                          const options = [item?.size && `o‘lcham: ${item.size}`, item?.color && `rang: ${item.color}`].filter(Boolean);
                          const price = item?.line_total ?? item?.unit_price;
                          return `${title}${quantity}${options.length ? ` (${options.join(', ')})` : ''}${price != null ? ` — ${money(price)}` : ''}`;
                        }).join('; ')
                        : order.items || '—';
                      return <tr key={order.id}>
                        <td className="px-5 py-4"><p className="font-semibold">#{order.id.slice(-6)}</p><p className="mt-1 text-xs text-stone-500">{date(order.created)}</p></td>
                        <td className="px-5 py-4"><p className="font-semibold">{customer?.name || (order.telegram_username ? `@${order.telegram_username}` : order.user || '—')}</p><p className="mt-1 text-xs text-stone-500">{customer?.telegram_username ? `@${customer.telegram_username}` : order.user || ''}</p></td>
                        <td className="max-w-[220px] px-5 py-4"><p>{order.phone || customer?.phone || '—'}</p><p className="mt-1 truncate text-xs text-stone-500">{order.delivery_address || customer?.address || '—'}</p></td>
                        <td className="max-w-[220px] px-5 py-4 text-xs text-stone-600">{itemNames}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold">{money(order.total_price)}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-[#f5f0e9] px-2.5 py-1 text-xs font-semibold text-[#795b3a]">{order.status || '—'}</span></td>
                        <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.notification_status === 'sent' ? 'bg-emerald-50 text-emerald-700' : order.notification_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{order.notification_status === 'sent' ? 'Yuborildi' : order.notification_status === 'failed' ? 'Xatolik' : 'Kutilmoqda'}</span></td>
                      </tr>;
                    })}</tbody>
                  </table>
                  {!searchableData.length && <EmptyState label="Buyurtmalar topilmadi." />}
                </div>
              )}
          </section>
        )}
      </main>

      {editor && <EditorModal
        kind={editor.kind}
        record={editor.record}
        products={data.products}
        onClose={() => setEditor(null)}
        onSave={(values) => saveRecord(editor.kind === 'product' ? 'products' : 'banner', editor.record?.id, values)}
      />}
    </div>
  );
}

function RecordActions({ onEdit, onDelete }) {
  return <div className="flex shrink-0 items-center gap-1">
    <button type="button" onClick={onEdit} aria-label="Tahrirlash" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Pencil className="h-4 w-4" /></button>
    <button type="button" onClick={onDelete} aria-label="O‘chirish" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
  </div>;
}

function EmptyState({ label }) {
  return <p className="px-5 py-12 text-center text-sm text-stone-500">{label}</p>;
}

function EditorModal({ kind, record, products, onClose, onSave }) {
  const product = kind === 'product';
  const [values, setValues] = useState(() => {
    const initialValues = { ...(product ? blankProduct : blankBanner), ...(record || {}) };
    return product ? {
      ...initialValues,
      color: normalizeProductOptions(initialValues.color),
      size: normalizeProductOptions(initialValues.size),
    } : initialValues;
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const originalImages = Array.isArray(record?.images) ? record.images : record?.images ? [record.images] : [];
  const [existingImages, setExistingImages] = useState(originalImages);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef(null);
  const previewUrls = useRef(new Set());
  const imageField = product ? 'images' : 'image';
  const previousImage = Array.isArray(record?.[imageField]) ? record[imageField][0] : record?.[imageField];
  const dimensions = product ? { width: 800, height: 800 } : { width: 1280, height: 720 };
  const linkedProductId = products.find((item) => resolveAppLink(values.url) === appHref(`/product/${item.id}`))?.id || '';

  useEffect(() => () => {
    previewUrls.current.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
  }, []);

  const selectImages = async (files) => {
    setError('');
    if (!files.length) return;
    if (files.length + (product ? images.length + existingImages.length : 0) > (product ? 10 : 1)) {
      setError(product ? 'Bitta mahsulot uchun 10 tagacha rasm tanlang.' : 'Banner uchun faqat bitta rasm tanlang.');
      return;
    }

    setProcessingImage(true);
    try {
      const preparedImages = [];
      for (const file of files) {
        preparedImages.push(await prepareImage(file, dimensions.width, dimensions.height));
      }
      const preparedPreviews = preparedImages.map((file) => URL.createObjectURL(file));
      preparedPreviews.forEach((imageUrl) => previewUrls.current.add(imageUrl));
      setImages((current) => product ? [...current, ...preparedImages] : preparedImages);
      setImagePreviews((current) => product ? [...current, ...preparedPreviews] : preparedPreviews);
    } catch (imageError) {
      setError(imageError.message);
    } finally {
      setProcessingImage(false);
    }
  };

  const removeImage = (index) => {
    const imageUrl = imagePreviews[index];
    URL.revokeObjectURL(imageUrl);
    previewUrls.current.delete(imageUrl);
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
    setImagePreviews((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const removeExistingImage = (filename) => {
    setExistingImages((current) => current.filter((image) => image !== filename));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = product ? {
      title: values.title.trim(),
      price: values.price === '' ? 0 : Number(values.price),
      discount_price: values.discount_price === '' ? 0 : Number(values.discount_price),
      description: values.description || '',
      color: values.color,
      size: values.size,
      category: values.category || '',
      in_stock: Boolean(values.in_stock),
    } : {
      title: values.title.trim(),
      url: values.url || '',
      is_active: Boolean(values.is_active),
    };
    const existingImagesChanged = existingImages.length !== originalImages.length
      || existingImages.some((image, index) => image !== originalImages[index]);
    if (images.length || existingImagesChanged) {
      payload[product ? 'images' : 'image'] = product ? [...existingImages, ...images] : images[0];
    }
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError?.message || "Saqlash amalga oshmadi.");
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, options = {}) => (
    <label key={name} className={`${options.wide ? 'sm:col-span-2' : ''} block text-sm font-semibold text-stone-700`}>
      {label}
      <input
        type={options.type || 'text'}
        value={values[name] ?? ''}
        required={options.required}
        min={options.type === 'number' ? '0' : undefined}
        step={options.type === 'number' ? 'any' : undefined}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        className="mt-2 h-11 w-full rounded-xl border border-stone-200 px-3.5 font-normal outline-none focus:border-[#9a8062]"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a8062]">{product ? 'Katalog' : 'Bosh sahifa'}</p><h2 className="mt-1 text-xl font-bold">{record ? 'Tahrirlash' : product ? 'Mahsulot qo‘shish' : 'Banner qo‘shish'}</h2></div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('title', 'Nomi', { required: true, wide: true })}
          {product ? <>
            {field('price', 'Narxi (so‘m)', { type: 'number', required: true })}
            {field('discount_price', 'Chegirmali narx (ixtiyoriy)', { type: 'number' })}
            <fieldset className="block text-sm font-semibold text-stone-700 sm:col-span-2">
              <legend>Ranglari</legend>
              <p className="mt-1 text-xs font-normal text-stone-500">Bir yoki bir nechta rangni tanlang.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...new Set([...productColors, ...values.color])].map((color) => {
                  const selected = values.color.includes(color);
                  const { name, hex } = colorDetails(color);
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setValues((current) => ({
                        ...current,
                        color: selected
                          ? current.color.filter((item) => item !== color)
                          : [...current.color, color],
                      }))}
                      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-[#8b6b48] bg-[#f8f5f1]' : 'border-stone-200 bg-white hover:border-[#9a8062]'}`}
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: hex }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{name}</span>
                        <span className="block text-[10px] font-normal text-stone-500">{hex}</span>
                      </span>
                      {selected && <span className="text-xs font-bold text-[#8b6b48]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="block text-sm font-semibold text-stone-700">
              <legend>O‘lchamlari</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {productSizes.map((size) => {
                  const selected = values.size.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setValues((current) => ({
                        ...current,
                        size: selected
                          ? current.size.filter((item) => item !== size)
                          : [...current.size, size],
                      }))}
                      className={`h-10 min-w-11 rounded-xl border px-3 text-sm font-semibold transition ${selected ? 'border-[#8b6b48] bg-[#8b6b48] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-[#9a8062]'}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold text-stone-700">Kategoriya
              <select value={values.category || ''} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 font-normal outline-none focus:border-[#9a8062]">
                <option value="">Tanlanmagan</option>                {['Ayollar uchun', 'Erkaklar uchun'].map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 px-3.5 py-3 text-sm font-semibold text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={Boolean(values.in_stock)} onChange={(event) => setValues((current) => ({ ...current, in_stock: event.target.checked }))} className="h-4 w-4 accent-[#8b6b48]" /> Omborda mavjud
            </label>
            <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">Tavsif
              <textarea rows="3" value={values.description || ''} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-stone-200 px-3.5 py-3 font-normal outline-none focus:border-[#9a8062]" />
            </label>
          </> : <>
            <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">
              Havola (ixtiyoriy)
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <input
                  type="text"
                  value={values.url || ''}
                  onChange={(event) => setValues((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://... yoki mahsulot manzili"
                  className="h-11 min-w-0 rounded-xl border border-stone-200 px-3.5 font-normal outline-none focus:border-[#9a8062]"
                />
                <select
                  value={linkedProductId}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    url: event.target.value ? `/product/${event.target.value}` : '',
                  }))}
                  aria-label="Bannerga mahsulot ulash"
                  className="h-11 min-w-0 rounded-xl border border-stone-200 bg-white px-3 font-normal outline-none focus:border-[#9a8062]"
                >
                  <option value="">Mahsulot tanlash</option>
                  {products.map((item) => <option key={item.id} value={item.id}>{item.title || 'Nomsiz mahsulot'}</option>)}
                </select>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 px-3.5 py-3 text-sm font-semibold text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={Boolean(values.is_active)} onChange={(event) => setValues((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#8b6b48]" /> Faol banner
            </label>
          </>}
          <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">
            {product ? 'Mahsulot rasmi' : 'Banner rasmi'}
            <span className="mt-1 block text-xs font-normal text-stone-500">
              {dimensions.width} × {dimensions.height} px, WEBP. Rasm markazdan kesib moslanadi.
              {product ? ' 10 tagacha rasm tanlash mumkin.' : ' Banner uchun bitta rasm.'}
            </span>
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              multiple={product}
              aria-label={product ? 'Mahsulot rasmlarini tanlash' : 'Banner rasmini tanlash'}
              onChange={(event) => {
                selectImages(Array.from(event.target.files || []));
                event.target.value = '';
              }}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              disabled={processingImage || saving || (product && images.length >= 10)}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-700 transition hover:border-[#9a8062] hover:bg-[#f8f5f1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {product ? 'Rasm qo‘shish' : 'Rasm tanlash'}
            </button>
            {imagePreviews.length > 0 || (product && existingImages.length > 0) ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {existingImages.map((filename, index) => (
                  <div key={filename} className={`relative ${product ? '' : 'col-span-3 sm:col-span-5'}`}>
                    <img
                      src={api.files.getURL(record, filename)}
                      alt={`Mavjud rasm ${index + 1}`}
                      className={`w-full rounded-xl bg-stone-100 object-cover ${product ? 'aspect-square' : 'aspect-video'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(filename)}
                      aria-label={`${index + 1}-rasmni olib tashlash`}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {imagePreviews.map((imageUrl, index) => (
                  <div key={imageUrl} className={`relative ${product ? '' : 'col-span-3 sm:col-span-5'}`}>
                    <img
                      src={imageUrl}
                      alt={`Yangi rasm ${index + 1}`}
                      className={`w-full rounded-xl bg-stone-100 object-cover ${product ? 'aspect-square' : 'aspect-video'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={`${index + 1}-rasmni olib tashlash`}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : previousImage && (
              <div className="mt-3">
                <img src={api.files.getURL(record, previousImage)} alt="Hozirgi rasm" className="col-span-3 aspect-video w-full rounded-xl bg-stone-100 object-cover sm:col-span-5" />
              </div>
            )}
            {(images.length > 0 || existingImages.length > 0) && <span className="mt-2 block text-xs font-medium text-emerald-700">{product ? `${existingImages.length + images.length}/10 ta rasm.` : 'Rasm tanlandi.'} WEBP formatida saqlanadi.</span>}
            {images.length === 0 && originalImages.length > 0 && existingImages.length === originalImages.length && <span className="mt-2 block text-xs font-normal text-stone-500">Yangi rasm tanlanmasa, hozirgi rasmlar saqlanadi.</span>}
          </label>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50">Bekor qilish</button>
          <button type="submit" disabled={saving || processingImage} className="h-11 flex-1 rounded-xl bg-[#24231f] text-sm font-bold text-white hover:bg-[#8b6b48] disabled:opacity-60">{processingImage ? 'Rasm tayyorlanmoqda...' : saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
        </div>
      </form>
    </div>
  );
}
