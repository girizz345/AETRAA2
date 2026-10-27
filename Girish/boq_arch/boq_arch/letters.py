"""Item letters: A, B, C ... never I or O; after Z roll to AA, BB ..."""

SINGLE = [c for c in "ABCDEFGHJKLMNPQRSTUVWXYZ"]


def letter(n: int) -> str:
    """0 -> A, 23 -> Z, 24 -> AA, 25 -> BB ..."""
    if n < len(SINGLE):
        return SINGLE[n]
    return SINGLE[(n - len(SINGLE)) % len(SINGLE)] * (2 + (n - len(SINGLE)) // len(SINGLE))
