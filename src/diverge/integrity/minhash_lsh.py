"""
minhash_lsh.py

Dependency-free MinHash + banded Locality-Sensitive Hashing for near-duplicate detection.

Naive near-duplicate search compares every pair of posts (O(n^2) Jaccard computations).
LSH splits each MinHash signature into `bands` bands of `rows` rows; two posts become a
*candidate pair* only if at least one band hashes identically, which happens with
probability 1 - (1 - J^rows)^bands. Only candidates are verified, so the cost is roughly
linear in the number of posts for realistic (mostly non-duplicate) streams.
"""

import re
import zlib
from collections import defaultdict
from typing import Dict, Iterable, List, Set, Tuple

import numpy as np

_MERSENNE_PRIME = np.uint64((1 << 61) - 1)
_MAX_HASH = np.uint64((1 << 32) - 1)
_TOKEN = re.compile(r"[\w$#@']+", re.UNICODE)


def shingles(text: str, k: int = 2) -> Set[str]:
    """Word k-shingles of a lower-cased text (falls back to unigrams for very short texts)."""
    tokens = _TOKEN.findall((text or "").lower())
    if len(tokens) < k:
        return set(tokens)
    return {" ".join(tokens[i : i + k]) for i in range(len(tokens) - k + 1)}


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


class MinHasher:
    """Universal-hash MinHash: h_i(x) = (a_i * x + b_i) mod p, truncated to 32 bits."""

    def __init__(self, num_perm: int = 128, seed: int = 1):
        rng = np.random.default_rng(seed)
        self.num_perm = num_perm
        self.a = rng.integers(1, (1 << 61) - 1, size=num_perm, dtype=np.uint64)
        self.b = rng.integers(0, (1 << 61) - 1, size=num_perm, dtype=np.uint64)

    def signature(self, items: Iterable[str]) -> np.ndarray:
        hv = np.array([zlib.crc32(s.encode("utf-8")) for s in items], dtype=np.uint64)
        if hv.size == 0:
            return np.full(self.num_perm, _MAX_HASH, dtype=np.uint64)
        # (a*x + b) mod p for every (perm, item); numpy uint64 arithmetic wraps, which is fine
        # for hashing purposes (it is still a well-mixed function of x).
        phv = (np.outer(self.a, hv) + self.b[:, None]) % _MERSENNE_PRIME & _MAX_HASH
        return phv.min(axis=1)


def estimated_jaccard(sig_a: np.ndarray, sig_b: np.ndarray) -> float:
    return float(np.mean(sig_a == sig_b))


def lsh_candidate_pairs(signatures: List[np.ndarray], bands: int = 32, rows: int = 4) -> Set[Tuple[int, int]]:
    """Indices (i, j), i < j, of signatures that collide in at least one LSH band."""
    candidates: Set[Tuple[int, int]] = set()
    for band in range(bands):
        buckets: Dict[bytes, List[int]] = defaultdict(list)
        for idx, sig in enumerate(signatures):
            buckets[sig[band * rows : (band + 1) * rows].tobytes()].append(idx)
        for members in buckets.values():
            if len(members) > 1:
                for x in range(len(members)):
                    for y in range(x + 1, len(members)):
                        candidates.add((members[x], members[y]))
    return candidates


def near_duplicate_pairs(
    texts: List[str], threshold: float = 0.8, num_perm: int = 128, bands: int = 32, use_lsh: bool = True
) -> List[Tuple[int, int, float]]:
    """
    All (i, j, jaccard) with exact shingle Jaccard >= threshold.
    use_lsh=False runs the exhaustive O(n^2) search (used as the benchmark baseline).
    """
    sets = [shingles(t) for t in texts]
    if use_lsh:
        hasher = MinHasher(num_perm=num_perm)
        sigs = [hasher.signature(s) for s in sets]
        pairs = lsh_candidate_pairs(sigs, bands=bands, rows=num_perm // bands)
    else:
        pairs = {(i, j) for i in range(len(sets)) for j in range(i + 1, len(sets))}
    out = []
    for i, j in pairs:
        sim = jaccard(sets[i], sets[j])
        if sim >= threshold:
            out.append((i, j, round(sim, 4)))
    return sorted(out)
