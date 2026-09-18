"""A complete CPU example for the Understanding PyTorch article.

Run: python pytorch_sensor.py
Requires: torch (verified with PyTorch 2.14.0, Python 3.12.4).
Writes sensor_weights.pt in the current directory.
"""

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


torch.manual_seed(7)

# Synthetic measurements: raw input -> calibrated target, plus noise.
x = torch.linspace(-2, 2, 201).reshape(-1, 1)
y = 2 * x + 1 + 0.15 * torch.randn_like(x)

# Split before training: 140 train, 40 validation, 21 test examples.
order = torch.randperm(len(x))
train_ids = order[:140]
val_ids = order[140:180]
test_ids = order[180:]
x_train, y_train = x[train_ids], y[train_ids]
x_val, y_val = x[val_ids], y[val_ids]
x_test, y_test = x[test_ids], y[test_ids]

train_data = TensorDataset(x_train, y_train)
train_loader = DataLoader(train_data, batch_size=20, shuffle=True)

model = nn.Linear(1, 1)
loss_fn = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.05)


def mse_on(inputs, targets):
    model.eval()
    with torch.inference_mode():
        return loss_fn(model(inputs), targets).item()


initial_val_mse = mse_on(x_val, y_val)
history = []
for epoch in range(100):
    model.train()
    for xb, yb in train_loader:
        optimizer.zero_grad(set_to_none=True)
        predictions = model(xb)
        loss = loss_fn(predictions, yb)
        loss.backward()
        optimizer.step()

    # Evaluate the current model, without changing its weights.
    train_mse = mse_on(x_train, y_train)
    val_mse = mse_on(x_val, y_val)
    history.append((train_mse, val_mse))

# Test data is used only after the fixed training run is complete.
test_mse = mse_on(x_test, y_test)
print(f"Initial validation MSE: {initial_val_mse:.4f}")
print(f"Final training MSE:     {train_mse:.4f}")
print(f"Final validation MSE:   {val_mse:.4f}")
print(f"Final test MSE:         {test_mse:.4f}")
print(f"Weight: {model.weight.item():.4f}")
print(f"Bias:   {model.bias.item():.4f}")

torch.save(model.state_dict(), "sensor_weights.pt")
restored = nn.Linear(1, 1)
restored.load_state_dict(
    torch.load("sensor_weights.pt", weights_only=True, map_location="cpu")
)
restored.eval()
with torch.inference_mode():
    new_input = torch.tensor([[1.5]])
    prediction = restored(new_input)
print(f"Prediction for x=1.5: {prediction.item():.4f}")
