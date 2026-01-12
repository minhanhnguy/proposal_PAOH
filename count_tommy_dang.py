import pandas as pd

df = pd.read_excel('public/proposal_dataset.xlsx')

# Search for proposals involving Tommy Dang (case-insensitive)
# Check all columns that might contain PI names
tommy_proposals = df[df.apply(lambda row: row.astype(str).str.contains('Tommy Dang', case=False).any(), axis=1)]

print(f"Number of proposals involving Dr. Tommy Dang: {len(tommy_proposals)}")
print("\nProposal titles:")
if 'Project Title' in df.columns:
    for i, title in enumerate(tommy_proposals['Project Title'].tolist(), 1):
        print(f"  {i}. {title}")
elif 'title' in df.columns:
    for i, title in enumerate(tommy_proposals['title'].tolist(), 1):
        print(f"  {i}. {title}")
