# -*- coding: utf-8 -*-
import sys
import locale
import os

locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from typing import List, Optional, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import torch
import torch.nn as nn
import numpy as np
from transformers import AutoModel, AutoTokenizer
from gigachat import GigaChat

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_NAME = "cointegrated/rubert-tiny2"
WEIGHTS_PATH = "./mbti_final_stage2.bin"
MAX_LEN = 512

GIGACHAT_AUTH_TOKEN = os.getenv("GIGACHAT_TOKEN", "")

THRESHOLDS = {"E": 0.63, "N": 0.66, "T": 0.48, "J": 0.57}
ORDER = ["E", "N", "T", "J"]
PAIRS = {"E": ("I","E"), "N": ("S","N"), "T": ("F","T"), "J": ("P","J")}

class MBTI_BERT(nn.Module):
    def __init__(self, freeze_bert=False):
        super().__init__()
        self.freeze_bert = freeze_bert
        self.bert = AutoModel.from_pretrained(MODEL_NAME)

        for p in self.bert.parameters():
            p.requires_grad = not freeze_bert

        self.bert_hidden = self.bert.config.hidden_size * 2
        self.drop = nn.Dropout(p=0.1)

        self.adapter_mbti = nn.Sequential(
            nn.Linear(self.bert_hidden, 256),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(256, self.bert_hidden),
            nn.LayerNorm(self.bert_hidden)
        )

        def make_head():
            return nn.Sequential(
                nn.Linear(self.bert_hidden, self.bert_hidden // 2),
                nn.GELU(),
                nn.Dropout(0.1),
                nn.Linear(self.bert_hidden // 2, 1)
            )

        self.mbti_E = make_head()
        self.mbti_N = make_head()
        self.mbti_T = make_head()
        self.mbti_J = make_head()

    def forward(self, input_ids, attention_mask):
        ctx = torch.no_grad() if self.freeze_bert else torch.enable_grad()
        with ctx:
            outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
            hidden_state = outputs.last_hidden_state

        input_mask_expanded = attention_mask.unsqueeze(-1).expand(hidden_state.size()).float()
        sum_embeddings = torch.sum(hidden_state * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        mean_pool = sum_embeddings / sum_mask

        hidden_state_masked = hidden_state.clone()
        hidden_state_masked[input_mask_expanded == 0] = -1e9
        max_pool = torch.max(hidden_state_masked, 1)[0]

        x = self.drop(torch.cat((mean_pool, max_pool), dim=1))
        feat = x + self.adapter_mbti(x)

        logits = torch.cat([
            self.mbti_E(feat), self.mbti_N(feat),
            self.mbti_T(feat), self.mbti_J(feat)
        ], dim=1)
        return logits


def load_state_dict_strict(model: nn.Module, path: str):
    sd = torch.load(path, map_location=DEVICE)
    if isinstance(sd, dict) and "state_dict" in sd:
        sd = sd["state_dict"]
    if any(k.startswith("module.") for k in sd.keys()):
        sd = {k.replace("module.", ""): v for k, v in sd.items()}
    model.load_state_dict(sd, strict=True)


def probs_to_type(probs: np.ndarray) -> str:
    out = []
    for i, dim in enumerate(ORDER):
        lo, hi = PAIRS[dim]
        out.append(hi if probs[i] >= THRESHOLDS[dim] else lo)
    return "".join(out)


def normalize_prob(prob: float, threshold: float) -> float:
    if prob < threshold:
        return 0.5 * (prob / threshold)
    else:
        return 0.5 + 0.5 * ((prob - threshold) / (1.0 - threshold))


app = FastAPI(title="MBTI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = MBTI_BERT(freeze_bert=True).to(DEVICE)
load_state_dict_strict(model, WEIGHTS_PATH)
model.eval()

class AnalyzeRequest(BaseModel):
    answers: List[str]
    free_text: Optional[str] = ""
    user_message: Optional[str] = ""

@app.get("/health")
def health():
    return {"ok": True, "device": str(DEVICE)}

@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
    parts = []
    for i, a in enumerate(req.answers[:5], start=1):
        if a.strip(): parts.append(f"[Q{i}] {a.strip()}")
    if req.free_text.strip():
        parts.append(f"[FREE] {req.free_text.strip()}")
    if req.user_message.strip():
        parts.append(f"[CHAT] {req.user_message.strip()}")

    text = "\n".join(parts).strip()
    if not text:
        text = "Нет данных"

    enc = tokenizer(text, max_length=MAX_LEN, padding="max_length", truncation=True, return_tensors="pt")
    input_ids = enc["input_ids"].to(DEVICE)
    attention_mask = enc["attention_mask"].to(DEVICE)

    with torch.no_grad():
        logits = model(input_ids, attention_mask)
        probs = torch.sigmoid(logits)[0].cpu().numpy()

    mbti_type = probs_to_type(probs)

    norm_percent = {}
    for i, dim in enumerate(ORDER):
        norm_percent[dim] = round(normalize_prob(float(probs[i]), THRESHOLDS[dim]) * 100, 1)

    if not GIGACHAT_AUTH_TOKEN:
        portrait = "Для получения развернутого психологического портрета укажите API-ключ GigaChat в переменной окружения GIGACHAT_TOKEN."
    else:
        prompt = f"""
        Ты — профессиональный психолог, специализирующийся на типологии личности MBTI.
        Нейросеть проанализировала текст пользователя и определила его вероятный тип как {mbti_type}.

        Результаты по шкалам:
        - Экстраверсия: {norm_percent['E']}%
        - Интуиция: {norm_percent['N']}%
        - Логика: {norm_percent['T']}%
        - Рациональность: {norm_percent['J']}%

        Напиши краткий (3-4 абзаца), тёплый и поддерживающий текст, обращаясь к пользователю на «Вы».

        **Требования к содержанию:**

        1. Сильные стороны — укажи 2-3 качества, которые обычно присущи людям этого типа.
        2. Возможные зоны роста (мягко, без критики) — на что стоит обратить внимание, что может вызывать дискомфорт или выгорание.
        3. Один совет по продуктивности или самоподдержке — что может помочь в работе или повседневной жизни.

        4. Важные оговорки (добавь в конец портрета):
           - Этот портрет — не диагноз и не истина в последней инстанции.
           - MBTI описывает предпочтения, а не способности или здоровье.
           - В разных ситуациях человек может проявлять разные черты.
           - Для глубокой работы над собой лучше обратиться к специалисту.

        **Стиль:**
        - Эмпатичный, но без излишней психологической нагрузки.
        - Без упоминания конкретных цифр (проценты не называй).
        - Без фраз «вы должны», «вам нужно исправить».
        - Используй «вы можете обратить внимание», «возможно, вам будет комфортнее».

        **Не упоминай:**
        - Диагнозы, расстройства, патологии.
        - Сравнения с другими типами («вы хуже, чем…», «в отличие от…»).
        - Категоричные утверждения («вы всегда…», «вы никогда…»).

        Сгенерируй портрет, следуя этим правилам.
        """
        try:
            with GigaChat(credentials=GIGACHAT_AUTH_TOKEN, verify_ssl_certs=False) as giga:
                response = giga.chat(prompt)
                portrait = response.choices[0].message.content
        except Exception as e:
            print(f"GigaChat error: {e}")
            portrait = "К сожалению, не удалось связаться с языковой моделью для генерации подробного описания."

    return {
        "mbti_type": mbti_type,
        "percent": norm_percent,
        "portrait": portrait,
    }
