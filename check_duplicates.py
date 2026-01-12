import pandas as pd

df = pd.read_excel('public/proposal_dataset.xlsx')
print("Total rows:", len(df))
print("Unique proposals:", df['proposal_no'].nunique())
print("\nDuplicate proposal examples:")
print(df[df.duplicated('proposal_no', keep=False)].sort_values('proposal_no').head(10)[['proposal_no', 'PI']].to_string())
