import pandas as pd

try:
    df = pd.read_excel('public/proposal_dataset.xlsx')
    print(df.head().to_string())
    print("\nColumns:", df.columns.tolist())
except Exception as e:
    print(e)
