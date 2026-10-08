import gspread
import pandas as pd

# Key file path
SERVICE_ACCOUNT_FILE = "cohesive-apogee-117512-bd567f7c7a61.json"

# Put native Google Sheet URL or ID here (not .xlsx file)
SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1HZzEFDZxF8LUoDbJoCG7DRTGnMkEbh_TnKYDUNXfFqk/edit"

def main():
    gc = gspread.service_account(filename=SERVICE_ACCOUNT_FILE)

    try:
        sh = gc.open_by_url(SPREADSHEET_URL)
    except gspread.exceptions.APIError as err:
        if "must not be an Office file" in str(err):
            print("ERROR: Target document is an uploaded .xlsx file.")
            print("Fix: Open file in Google Sheets -> Click 'File' -> 'Save as Google Sheets'.")
            print("Then share new sheet with service account and update SPREADSHEET_URL.")
            return
        raise err

    # Open worksheet by gid (1342242311) or default first worksheet
    worksheet = None
    target_gid = 1342242311
    try:
        worksheet = sh.get_worksheet_by_id(target_gid)
    except Exception:
        pass

    if worksheet is None:
        worksheet = sh.sheet1

    print(f"Loaded worksheet: {worksheet.title}")
    
    # Read all records
    records = worksheet.get_all_records()
    df = pd.DataFrame(records)
    print(df.head())
    return df

if __name__ == "__main__":
    main()