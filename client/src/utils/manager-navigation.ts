export function buildManagerUrl(
  basePath: string,
  params: Record<string, string | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const qs = searchParams.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

export function preserveManagerContext(
  basePath: string,
  organizationId?: string,
  buildingId?: string,
  extraParams?: Record<string, string | undefined>
): string {
  return buildManagerUrl(basePath, {
    organization: organizationId,
    building: buildingId,
    ...extraParams,
  });
}
