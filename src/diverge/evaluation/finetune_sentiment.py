"""
finetune_sentiment.py

Fine-tunes FinBERT (ProsusAI/finbert, pre-trained on financial news) on finance *tweets*
(zeroshot/twitter-financial-news-sentiment, train split) so the pipeline's sentiment model
matches the short, slangy text it actually scores.

  - 90/10 split of the train set for model selection (best epoch by macro-F1 on the 10%)
  - the official validation split is never touched here; sentiment_benchmark.py uses it as test
  - mixed precision on CUDA; ~5-10 min on a laptop RTX 3060

Output: models/finbert-tweets  (picked up automatically by features/text_features.py)

Run:  python -m diverge.evaluation.finetune_sentiment --epochs 3
"""

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np

from .sentiment_benchmark import FINBERT_TO_LABEL, LABELS, load_split

BASE_MODEL = "ProsusAI/finbert"
OUT_DIR = Path("models/finbert-tweets")


def main(epochs: int = 3, lr: float = 2e-5, batch_size: int = 32, seed: int = 42) -> None:
    import torch
    from sklearn.metrics import f1_score
    from torch.utils.data import DataLoader
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL).to(device)
    # FinBERT's own label ids: map our label names onto them so the head is reused, not re-initialised
    label_to_id = {FINBERT_TO_LABEL[v.lower()]: int(k) for k, v in model.config.id2label.items()}

    texts, labels = load_split("train")
    idx = np.random.permutation(len(texts))
    cut = int(0.9 * len(idx))
    tr, dev = idx[:cut], idx[cut:]

    def batches(ids, shuffle):
        def collate(b):
            enc = tok([texts[i] for i in b], padding=True, truncation=True, max_length=96, return_tensors="pt")
            enc["labels"] = torch.tensor([label_to_id[labels[i]] for i in b])
            return enc
        return DataLoader(list(ids), batch_size=batch_size, shuffle=shuffle, collate_fn=collate)

    train_dl, dev_dl = batches(tr, True), batches(dev, False)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    sched = get_linear_schedule_with_warmup(opt, int(0.1 * len(train_dl) * epochs), len(train_dl) * epochs)
    scaler = torch.amp.GradScaler(enabled=device == "cuda")

    best, history = -1.0, []
    t0 = time.perf_counter()
    for epoch in range(1, epochs + 1):
        model.train()
        for batch in train_dl:
            batch = {k: v.to(device) for k, v in batch.items()}
            with torch.autocast(device_type=device, enabled=device == "cuda"):
                loss = model(**batch).loss
            opt.zero_grad(); scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); sched.step()

        model.eval(); preds, gold = [], []
        with torch.inference_mode():
            for batch in dev_dl:
                gold += batch.pop("labels").tolist()
                preds += model(**{k: v.to(device) for k, v in batch.items()}).logits.argmax(-1).tolist()
        f1 = f1_score(gold, preds, average="macro")
        history.append({"epoch": epoch, "dev_macro_f1": round(float(f1), 4)})
        print(f"epoch {epoch}: dev macro-F1 = {f1:.4f}")
        if f1 > best:
            best = f1
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(OUT_DIR); tok.save_pretrained(OUT_DIR)

    meta = {"base_model": BASE_MODEL, "epochs": epochs, "lr": lr, "batch_size": batch_size,
            "train_examples": len(tr), "dev_examples": len(dev), "history": history,
            "best_dev_macro_f1": round(float(best), 4), "train_minutes": round((time.perf_counter() - t0) / 60, 2),
            "device": torch.cuda.get_device_name(0) if device == "cuda" else "cpu", "labels": LABELS}
    (OUT_DIR / "training_meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--batch-size", type=int, default=32)
    args = ap.parse_args()
    main(args.epochs, args.lr, args.batch_size)
