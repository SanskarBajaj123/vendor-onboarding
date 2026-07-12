from rapidfuzz import fuzz

# Below this score, two strings are considered a genuine mismatch rather than
# a formatting difference (e.g. "Acme Inc." vs "Acme Incorporated" scores ~90+).
NAME_MATCH_THRESHOLD = 90
ADDRESS_MATCH_THRESHOLD = 70


def fuzzy_match(a: str, b: str) -> int:
    if not a or not b:
        return 0
    return fuzz.token_sort_ratio(a.strip().lower(), b.strip().lower())


def names_match(a: str, b: str) -> bool:
    return fuzzy_match(a, b) >= NAME_MATCH_THRESHOLD


def addresses_match(a: str, b: str) -> bool:
    return fuzzy_match(a, b) >= ADDRESS_MATCH_THRESHOLD


def tax_ids_match(a: str, b: str) -> bool:
    """Tax IDs are exact-match after normalizing whitespace/case/hyphens —
    this is an identity field, not a formatting-tolerant one."""
    normalize = lambda s: (s or "").strip().upper().replace("-", "").replace(" ", "")
    return normalize(a) == normalize(b)
