# Reads the sales exports the shops upload. They are comma-separated, with a header row.
import csv


def rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))
