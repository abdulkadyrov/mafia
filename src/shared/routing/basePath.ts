export function getBasePath(): string {
  return import.meta.env.BASE_URL;
}

export function createAppPath(path: string): string {
  const basePath = getBasePath();
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${basePath}${normalizedPath}`;
}

export function createHashAppPath(path: string): string {
  const basePath = getBasePath();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${basePath}#${normalizedPath}`;
}

export function getPathWithoutBase(pathname: string): string {
  const basePath = getBasePath();

  if (basePath !== "/" && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length - 1);
  }

  return pathname;
}
