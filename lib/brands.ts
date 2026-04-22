const BRAND_LOCALE = 'ru-RU';
const MIN_SINGLE_TOKEN_ALIAS_LENGTH = 4;

function getBrandTokens(value: string) {
  return value.match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function normalizeBrand(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ');

  return normalized ? normalized.toLocaleUpperCase(BRAND_LOCALE) : undefined;
}

export function normalizeBrandFilter(value: string | null | undefined) {
  if (value?.trim().toLowerCase() === 'all') {
    return 'all';
  }

  return normalizeBrand(value) ?? 'all';
}

function canUseAsAliasBase(tokens: string[], brand: string) {
  return tokens.length > 1 || brand.length >= MIN_SINGLE_TOKEN_ALIAS_LENGTH;
}

function containsTokenSequence(tokens: string[], sequence: string[]) {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }

  return tokens.some((_, startIndex) =>
    sequence.every((token, offset) => tokens[startIndex + offset] === token)
  );
}

function isBrandAlias(brand: string, candidateBase: string) {
  if (brand === candidateBase) {
    return true;
  }

  const brandTokens = getBrandTokens(brand);
  const candidateTokens = getBrandTokens(candidateBase);

  if (!canUseAsAliasBase(candidateTokens, candidateBase)) {
    return false;
  }

  return containsTokenSequence(brandTokens, candidateTokens);
}

function compareBrandSpecificity(left: string, right: string) {
  const leftTokenCount = getBrandTokens(left).length;
  const rightTokenCount = getBrandTokens(right).length;

  return (
    leftTokenCount - rightTokenCount ||
    left.length - right.length ||
    left.localeCompare(right, BRAND_LOCALE)
  );
}

export function createCanonicalBrandMap(values: Array<string | null | undefined>) {
  const brands = Array.from(
    new Set(
      values
        .map((value) => normalizeBrand(value))
        .filter((brand): brand is string => Boolean(brand))
    )
  ).sort(compareBrandSpecificity);
  const canonicalBrands: string[] = [];
  const canonicalByBrand = new Map<string, string>();

  for (const brand of brands) {
    const canonicalBrand = canonicalBrands.find((candidate) =>
      isBrandAlias(brand, candidate)
    );

    if (canonicalBrand) {
      canonicalByBrand.set(brand, canonicalBrand);
      continue;
    }

    canonicalBrands.push(brand);
    canonicalByBrand.set(brand, brand);
  }

  return canonicalByBrand;
}

export function getCanonicalBrand(
  value: string | null | undefined,
  canonicalByBrand: Map<string, string>
) {
  const brand = normalizeBrand(value);

  return brand ? canonicalByBrand.get(brand) ?? brand : undefined;
}

export function getCanonicalBrandFilter(
  value: string | null | undefined,
  canonicalByBrand: Map<string, string>
) {
  if (value?.trim().toLowerCase() === 'all') {
    return 'all';
  }

  return getCanonicalBrand(value, canonicalByBrand) ?? 'all';
}
