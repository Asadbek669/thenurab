const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const appHref = (path = '') => `${basePath}/${path.replace(/^\/+/, '')}`;

export const resolveAppLink = (url) => {
  if (!url) return '#products';
  try {
    const target = new URL(url, window.location.href);
    if (!['http:', 'https:'].includes(target.protocol)) return '#products';
    const localTarget = target.origin === window.location.origin
      || ['localhost', '127.0.0.1'].includes(target.hostname);
    if (!localTarget) return target.href;
    const route = basePath && (target.pathname === basePath || target.pathname.startsWith(`${basePath}/`))
      ? target.pathname.slice(basePath.length)
      : target.pathname;
    return appHref(`${route}${target.search}${target.hash}`);
  } catch {
    return '#products';
  }
};

export const getAppPath = () => {
  const pathname = window.location.pathname;
  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname;
};
