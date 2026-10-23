from ingest.reader import rows

UNIT = ""


def average_ticket(path):
    sales = rows(path)
    return sum(int(r["amount"]) for r in sales) / len(sales)
