import pandas as pd
import json

df = pd.read_csv('E:/GroundWatermain/Atal_Jal_Disclosed_Ground_Water_Level-2015-2022.csv', encoding='latin1', low_memory=False)
info = {
    'Rows': len(df),
    'Columns': list(df.columns),
    'Missing values per column': df.isna().sum().to_dict(),
    'Head': df.head().to_dict(orient='records')
}
with open('E:/GroundWatermain/dataset_analysis.json', 'w') as f:
    json.dump(info, f, indent=4)
print("Analysis complete")
