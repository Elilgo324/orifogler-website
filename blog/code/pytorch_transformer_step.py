"""One causal transformer training step, not a trained language model.

Run: python pytorch_transformer_step.py
Requires torch; verified with PyTorch 2.14.0 and Python 3.12.4 on CPU.
"""

import torch
from torch import nn

torch.manual_seed(7)
text = "hello"
vocabulary = sorted(set(text))
char_to_id = {char: i for i, char in enumerate(vocabulary)}
ids = torch.tensor([[char_to_id[c] for c in text]])
inputs = ids[:, :-1]   # "hell": shape [1, 4]
targets = ids[:, 1:]   # "ello": shape [1, 4]
vocab_size = len(vocabulary)


class TinyTransformer(nn.Module):
    def __init__(self, vocab_size, max_length=4):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, 32)
        self.position_embedding = nn.Embedding(max_length, 32)
        self.block = nn.TransformerEncoderLayer(
            d_model=32,
            nhead=4,
            dim_feedforward=64,
            dropout=0.0,
            batch_first=True,
            norm_first=True,
        )
        self.final_norm = nn.LayerNorm(32)
        self.output = nn.Linear(32, vocab_size)

    def forward(self, token_ids):
        length = token_ids.shape[1]
        positions = torch.arange(length, device=token_ids.device)
        hidden = (
            self.token_embedding(token_ids)
            + self.position_embedding(positions)
        )
        blocked = torch.triu(
            torch.ones(length, length, dtype=torch.bool,
                       device=token_ids.device),
            diagonal=1,
        )
        hidden = self.block(hidden, src_mask=blocked)
        return self.output(self.final_norm(hidden))


transformer = TinyTransformer(vocab_size)
transformer_optimizer = torch.optim.SGD(
    transformer.parameters(), lr=0.1
)
transformer.train()
transformer_optimizer.zero_grad(set_to_none=True)
logits = transformer(inputs)   # [1, 4, 4]
token_loss = nn.CrossEntropyLoss()(
    logits.reshape(-1, vocab_size),  # [4, 4]
    targets.reshape(-1),            # [4]
)
token_loss.backward()
transformer_optimizer.step()
print("Logits shape:", tuple(logits.shape))
print("Loss before the update:", round(token_loss.item(), 4))
