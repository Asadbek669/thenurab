const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const appHref = (path = '') => `${basePath}/${path.replace(/^\/+/, '')}`;

export const getAppPath = () => {
  const pathname = window.location.pathname;
  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname;
};
