"""
sentiment_benchmark.py

Benchmarks every sentiment model the pipeline can use on a public, human-labelled financial
social-media dataset:

  Dataset: zeroshot/twitter-financial-news-sentiment (Hugging Face)
           ~9.5k train / 2,388 validation finance tweets, labels Bearish / Bullish / Neutral.
           The official validation split is used as the held-out test set; nothing below is
           tuned on it.

  Models:  1. keyword lexicon         (the pipeline's offline fallback)
           2. TF-IDF + logistic regression trained on the train split (classic ML baseline)
           3. FinBERT zero-shot       (ProsusAI/finbert, trained on news, not tweets)
           4. FinBERT fine-tuned      (models/finbert-tweets, produced by finetune_sentiment.py)

Reports accuracy, macro-F1, per-class F1 and inference throughput (texts/sec).

Run:  python -m diverge.evaluation.sentiment_benchmark
Needs: pip install -r requirements-eval.txt
"""

import argparse
import json
import time
from pathlib import Path
from typing import Callable, Dict, List

import numpy as np

from ..features.text_features import _keyword_sentiment
from .report import save_json

DATASET = "zeroshot/twitter-financial-news-sentiment"
LABELS = ["bearish", "bullish", "neutral"]  # dataset ids 0, 1, 2
FINETUNED_DIR = Path("models/finbert-tweets")
FINBERT_TO_LABEL = {"negative": "bearish", "positive": "bullish", "neutral": "neutral"}


def load_split(split: str):
    from datasets import load_dataset

    ds = load_dataset(DATASET, split=split)
    return list(ds["text"]), [LABELS[i] for i in ds["label"]]


def _score(name: str, y_true: List[str], y_pred: List[str], seconds: float) -> Dict:
    from sklearn.metrics import accuracy_score, f1_score

    per_class = f1_score(y_true, y_pred, labels=LABELS, average=None)
    return {
        "model": name,
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro")), 4),
        "f1_per_class": {lab: round(float(v), 4) for lab, v in zip(LABELS, per_class)},
        "texts_per_sec": round(len(y_true) / max(seconds, 1e-9), 1),
    }


def _timed(fn: Callable[[List[str]], List[str]], texts: List[str]):
    t0 = time.perf_counter()
    preds = fn(texts)
    return preds, time.perf_counter() - t0


def keyword_model(texts: List[str]) -> List[str]:
    return [_keyword_sentiment(t)[1] for t in texts]


def tfidf_model(train_x, train_y):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline

    pipe = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True),
        LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced"),
    ).fit(train_x, train_y)
    return lambda texts: list(pipe.predict(texts))


def transformer_model(model_path: str, batch_size: int = 64):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path).to(device).eval()
    id2label = {int(k): v.lower() for k, v in model.config.id2label.items()}

    @torch.inference_mode()
    def predict(texts: List[str]) -> List[str]:
        out: List[str] = []
        for i in range(0, len(texts), batch_size):
            enc = tok(texts[i : i + batch_size], padding=True, truncation=True, max_length=96, return_tensors="pt").to(device)
            with torch.autocast(device_type=device, enabled=device == "cuda"):
                logits = model(**enc).logits
            out += [FINBERT_TO_LABEL.get(id2label[j], id2label[j]) for j in logits.argmax(-1).tolist()]
        return out

    return predict


def run(out_dir: Path = Path("reports"), skip_transformers: bool = False) -> Dict:
    train_x, train_y = load_split("train")
    test_x, test_y = load_split("validation")
    results = {"dataset": DATASET, "train_size": len(train_x), "test_size": len(test_x),
               "test_label_distribution": {lab: test_y.count(lab) for lab in LABELS}, "models": []}

    preds, s = _timed(keyword_model, test_x)
    results["models"].append(_score("Keyword lexicon (baseline)", test_y, preds, s))

    preds, s = _timed(tfidf_model(train_x, train_y), test_x)
    results["models"].append(_score("TF-IDF + logistic regression", test_y, preds, s))

    if not skip_transformers:
        preds, s = _timed(transformer_model("ProsusAI/finbert"), test_x)
        results["models"].append(_score("FinBERT zero-shot (ProsusAI/finbert)", test_y, preds, s))
        if FINETUNED_DIR.exists():
            preds, s = _timed(transformer_model(str(FINETUNED_DIR)), test_x)
            results["models"].append(_score("FinBERT fine-tuned on finance tweets", test_y, preds, s))
            from sklearn.metrics import confusion_matrix

            results["finetuned_confusion_matrix"] = {
                "labels": LABELS, "matrix": confusion_matrix(test_y, preds, labels=LABELS).tolist()
            }

    save_json(results, out_dir / "sentiment_benchmark.json")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=Path("reports"))
    ap.add_argument("--skip-transformers", action="store_true", help="only run the CPU baselines")
    args = ap.parse_args()
    print(json.dumps(run(args.out, args.skip_transformers), indent=2))
