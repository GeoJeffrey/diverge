import random
import unittest

from diverge.integrity import duplicate_detection
from diverge.integrity.minhash_lsh import MinHasher, estimated_jaccard, jaccard, near_duplicate_pairs, shingles


def _corpus(n_unique=200, n_clusters=10, copies=5, seed=0):
    rng = random.Random(seed)
    vocab = [f"w{i}" for i in range(2000)]
    texts = [" ".join(rng.choices(vocab, k=25)) for _ in range(n_unique)]
    for _ in range(n_clusters):
        base = rng.choices(vocab, k=25)
        for _ in range(copies):
            t = list(base)
            t[rng.randrange(len(t))] = rng.choice(vocab)  # one-word mutation
            texts.append(" ".join(t))
    return texts


class TestMinHashLSH(unittest.TestCase):
    def test_minhash_estimates_jaccard(self):
        a, b = shingles("buy tsla now it will moon soon trust me"), shingles("buy tsla now it will moon today trust me")
        h = MinHasher(num_perm=256)
        self.assertAlmostEqual(estimated_jaccard(h.signature(a), h.signature(b)), jaccard(a, b), delta=0.1)

    def test_lsh_finds_same_pairs_as_brute_force(self):
        texts = _corpus()
        exact = near_duplicate_pairs(texts, threshold=0.8, use_lsh=False)
        approx = near_duplicate_pairs(texts, threshold=0.8, use_lsh=True)
        self.assertGreater(len(exact), 0)
        recall = len(set(exact) & set(approx)) / len(exact)
        self.assertGreaterEqual(recall, 0.95)
        self.assertTrue(set(approx) <= set(exact))  # LSH candidates are verified exactly

    def test_same_account_duplicates_do_not_count(self):
        posts = [
            {"post_id": "1", "account_id": "bot", "raw_text": "nvda to the moon buy buy buy right now"},
            {"post_id": "2", "account_id": "bot", "raw_text": "nvda to the moon buy buy buy right now"},
            {"post_id": "3", "account_id": "human", "raw_text": "earnings look fine but valuation is stretched"},
        ]
        self.assertEqual(duplicate_detection.compute_duplicate_ratio(posts), 0.0)


if __name__ == "__main__":
    unittest.main()
