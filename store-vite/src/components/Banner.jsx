import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import pb from '../lib/pocketbase';
import { appHref } from '../lib/routes';

export default function Banner({ banners, loading = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedImageName, setLoadedImageName] = useState('');
  const currentIndex = banners.length ? activeIndex % banners.length : 0;
  const banner = banners[currentIndex];
  const imageName = Array.isArray(banner?.image) ? banner.image[0] : banner?.image;
  const hasMultipleBanners = banners.length > 1;

  useEffect(() => {
    if (!hasMultipleBanners) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [banners.length, hasMultipleBanners]);

  const changeBanner = (direction) => {
    setActiveIndex((current) => (current + direction + banners.length) % banners.length);
  };

  if (loading) {
    return (
      <section aria-label="Banner yuklanmoqda" aria-busy="true" className="skeleton-shimmer aspect-[16/9] min-h-52 overflow-hidden rounded-[28px] sm:aspect-[16/7] sm:min-h-[300px] sm:rounded-[36px] lg:aspect-[16/6] lg:min-h-[400px]" />
    );
  }

  return (
    <section aria-busy={Boolean(imageName && loadedImageName !== imageName)} className="relative isolate aspect-[16/9] min-h-52 overflow-hidden rounded-[28px] bg-[#292820] shadow-[0_24px_70px_rgba(39,35,28,0.16)] sm:aspect-[16/7] sm:min-h-[300px] sm:rounded-[36px] lg:aspect-[16/6] lg:min-h-[400px]">
      <a
        href={banner.url ? (banner.url.startsWith('/') ? appHref(banner.url) : banner.url) : '#products'}
        aria-label={banner.title ? `Banner: ${banner.title}` : 'Banner orqali mahsulotlarni ko‘rish'}
        className="absolute inset-0 z-0 block overflow-hidden"
      >
        {imageName ? (
          <>
            {loadedImageName !== imageName && <div className="skeleton-shimmer absolute inset-0" />}
            <img
              key={imageName}
              src={pb.files.getURL(banner, imageName)}
              alt={banner.title || 'THENURAB banner'}
              onLoad={() => setLoadedImageName(imageName)}
              className={`h-full w-full object-cover transition duration-700 hover:scale-[1.02] ${loadedImageName === imageName ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#51483c] to-[#201f1b]" />
        )}
      </a>
      {hasMultipleBanners && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 sm:bottom-6 sm:right-6">
          <button type="button" onClick={() => changeBanner(-1)} aria-label="Oldingi banner" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold text-white drop-shadow">{currentIndex + 1} / {banners.length}</span>
          <button type="button" onClick={() => changeBanner(1)} aria-label="Keyingi banner" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
