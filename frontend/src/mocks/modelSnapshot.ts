// GENERATED from src/diverge/outlook/outlook_model.json (the committed model), in the same shape
// /outlook/model serves. Demo mode shows these real walk-forward results. Do not edit by hand.
export const MODEL_SNAPSHOT = {
  "version": "20261121",
  "trained_at": "2026-11-21T17:24:03+00:00",
  "training_data": {
    "source": "mjw/stock_market_tweets",
    "sentiment_model": "auto",
    "ticker_days": 6320,
    "first_day": "2014-12-31",
    "last_day": "2020-01-08"
  },
  "track_record": {
    "test_period": "2016-01-04 to 2020-01-08",
    "test_days": 5055,
    "tickers": [
      "AAPL",
      "AMZN",
      "GOOG",
      "MSFT",
      "TSLA"
    ],
    "direction": {
      "auc": 0.5072,
      "accuracy": 0.5159,
      "always_up_accuracy": 0.5401,
      "brier": 0.2505,
      "lean_calls": {
        "share_of_days": 0.2322,
        "accuracy": 0.5264,
        "days": 1174
      },
      "slight_calls": {
        "share_of_days": 0.4263,
        "accuracy": 0.5197,
        "days": 2155
      },
      "no_call": {
        "share_of_days": 0.3414,
        "accuracy": 0.5041,
        "days": 1726
      },
      "calibration": [
        {
          "mean_predicted": 0.4541,
          "actual_up_rate": 0.5232,
          "days": 1011
        },
        {
          "mean_predicted": 0.4934,
          "actual_up_rate": 0.546,
          "days": 1011
        },
        {
          "mean_predicted": 0.5158,
          "actual_up_rate": 0.544,
          "days": 1011
        },
        {
          "mean_predicted": 0.5352,
          "actual_up_rate": 0.543,
          "days": 1011
        },
        {
          "mean_predicted": 0.5727,
          "actual_up_rate": 0.544,
          "days": 1011
        }
      ]
    },
    "move": {
      "oos_r2": 0.1773,
      "oos_r2_price_only": 0.1248,
      "rank_corr": 0.3367,
      "larger_than_usual_calls": {
        "share_of_days": 0.2669,
        "precision": 0.493,
        "base_rate": 0.3925,
        "lift": 1.26
      }
    }
  },
  "features": [
    {
      "feature": "abs_ret",
      "label": "Today's price move size",
      "kind": "price",
      "direction_weight": -0.037,
      "move_weight": -0.001058
    },
    {
      "feature": "abs_ret_5",
      "label": "Recent volatility (5 days)",
      "kind": "price",
      "direction_weight": -0.08493,
      "move_weight": 0.001306
    },
    {
      "feature": "abs_ret_22",
      "label": "Volatility (1 month)",
      "kind": "price",
      "direction_weight": 0.05009,
      "move_weight": 0.003029
    },
    {
      "feature": "mkt_abs_ret",
      "label": "Market-wide move today",
      "kind": "price",
      "direction_weight": 0.04583,
      "move_weight": 0.000807
    },
    {
      "feature": "ret",
      "label": "Today's return",
      "kind": "price",
      "direction_weight": -0.03744,
      "move_weight": -0.000912
    },
    {
      "feature": "ret_5",
      "label": "5-day price momentum",
      "kind": "price",
      "direction_weight": -0.06979,
      "move_weight": -0.000947
    },
    {
      "feature": "log_volume",
      "label": "Post volume",
      "kind": "narrative",
      "direction_weight": -0.08203,
      "move_weight": 0.000614
    },
    {
      "feature": "volume_z",
      "label": "Attention spike vs usual",
      "kind": "narrative",
      "direction_weight": 0.0384,
      "move_weight": 0.000705
    },
    {
      "feature": "mean_sentiment",
      "label": "Average sentiment",
      "kind": "narrative",
      "direction_weight": 0.14802,
      "move_weight": -0.000675
    },
    {
      "feature": "bull_share",
      "label": "Share of bullish posts",
      "kind": "narrative",
      "direction_weight": -0.08115,
      "move_weight": -0.000358
    },
    {
      "feature": "sentiment_z",
      "label": "Sentiment shift vs usual",
      "kind": "narrative",
      "direction_weight": -0.00281,
      "move_weight": 0.000667
    },
    {
      "feature": "disagreement",
      "label": "Bull/bear disagreement",
      "kind": "narrative",
      "direction_weight": 0.04136,
      "move_weight": -0.000147
    },
    {
      "feature": "new_author_share",
      "label": "New voices joining",
      "kind": "narrative",
      "direction_weight": -0.09758,
      "move_weight": -0.000277
    },
    {
      "feature": "rn",
      "label": "Narrative contagion (Rn)",
      "kind": "narrative",
      "direction_weight": 0.0568,
      "move_weight": 0.003092
    },
    {
      "feature": "capitulation_share",
      "label": "Capitulation language",
      "kind": "narrative",
      "direction_weight": 0.00571,
      "move_weight": 0.000125
    },
    {
      "feature": "duplicate_share",
      "label": "Copy-paste (coordinated) posts",
      "kind": "narrative",
      "direction_weight": -0.00198,
      "move_weight": -3.2e-05
    },
    {
      "feature": "divergence",
      "label": "Sentiment vs price divergence",
      "kind": "narrative",
      "direction_weight": 0.0001,
      "move_weight": -3.2e-05
    }
  ]
} as const;
