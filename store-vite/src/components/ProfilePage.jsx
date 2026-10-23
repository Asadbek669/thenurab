import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Send, ShieldCheck, UserRound } from 'lucide-react';
import api from '../lib/api';
import { appHref } from '../lib/routes';

export default function ProfilePage() {
  const webApp = window.Telegram?.WebApp;
  const initData = webApp?.initData || '';
  const [profile, setProfile] = useState(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(Boolean(initData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!initData) return undefined;

    let active = true;
    webApp.ready();
    api.send('/api/telegram/profile', {
      method: 'POST',
      body: { initData },
    })
      .then((result) => {
        if (!active) return;
        setProfile(result.profile);
        setAddress(result.profile.address || '');
        setPhone(result.profile.phone || '');
      })
      .catch((requestError) => {
        console.error('Telegram profilini yuklashda xatolik:', requestError);
        if (active) setError(requestError?.response?.message || 'Telegram profilingizni yuklab bo‘lmadi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initData, webApp]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await api.send('/api/telegram/profile', {
        method: 'POST',
        body: { initData, address: address.trim(), phone: phone.trim() },
      });
      setProfile(result.profile);
      setAddress(result.profile.address || '');
      setPhone(result.profile.phone || '');
      setSaved(true);
    } catch (saveError) {
      console.error('Profilni saqlashda xatolik:', saveError);
      setError(saveError?.response?.message || "Profilni saqlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f4f0] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <a href={appHref()} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-[#8b6b48]">
          <ArrowLeft className="h-4 w-4" /> Do‘konga qaytish
        </a>
        <section className="mt-7 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(39,35,28,0.08)] sm:mt-9">
          <div className="bg-[#24231f] px-6 py-7 text-white sm:px-9 sm:py-9">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7dac8] text-xl font-bold uppercase text-[#5e4831]">
              {profile?.name?.trim()?.charAt(0) || <UserRound className="h-6 w-6" />}
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#d6b68f]">Shaxsiy maʼlumotlar</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{profile?.name || 'Profil'}</h1>
            {profile?.telegram_username && <p className="mt-2 text-sm text-stone-300">@{profile.telegram_username}</p>}
          </div>

          {loading ? <p className="px-6 py-12 text-center text-sm text-stone-500">Profil yuklanmoqda...</p>
            : !initData ? (
              <div className="px-6 py-10 text-center sm:px-9">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f0e9] text-[#8b6b48]"><Send className="h-6 w-6" /></span>
                <h2 className="mt-4 text-lg font-bold">Telegram orqali kiring</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                  Profilingizni xavfsiz ochish uchun do‘konni Telegram bot ichidagi Mini App orqali ishga tushiring.
                </p>
              </div>
            ) : (
              <form onSubmit={saveProfile} className="space-y-5 px-6 py-7 sm:px-9 sm:py-9">
                <label className="block text-sm font-semibold text-stone-700">
                  Ism
                  <input readOnly value={profile?.name || ''} className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-stone-500 outline-none" />
                  <span className="mt-1.5 block text-xs font-normal text-stone-400">Ism Telegram profilingizdan tasdiqlanadi.</span>
                </label>
                <label className="block text-sm font-semibold text-stone-700">
                  Yetkazib berish manzili
                  <span className="relative mt-2 block">
                    <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <textarea required rows="3" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Shahar, ko‘cha, uy va xonadon" className="w-full resize-y rounded-xl border border-stone-200 py-3 pl-11 pr-4 outline-none focus:border-[#9a8062]" />
                  </span>
                </label>
                <label className="block text-sm font-semibold text-stone-700">
                  Telefon raqami (ixtiyoriy)
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#9a8062]" />
                </label>
                <div className="flex items-start gap-2 rounded-xl bg-[#f7f4ef] p-3 text-xs leading-5 text-stone-500">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8b6b48]" />
                  Telegram ID va ismingiz Telegram tomonidan tasdiqlanadi; manzil va telefon faqat profilingizda saqlanadi.
                </div>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                {saved && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Profil maʼlumotlari saqlandi.</p>}
                <button disabled={saving} className="h-12 w-full rounded-xl bg-[#24231f] text-sm font-bold text-white transition hover:bg-[#8b6b48] disabled:opacity-60">
                  {saving ? 'Saqlanmoqda...' : 'Profilni saqlash'}
                </button>
              </form>
            )}
        </section>
      </div>
    </main>
  );
}
