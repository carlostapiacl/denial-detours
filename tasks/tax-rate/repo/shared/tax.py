# Value-added tax in Chile, as a fraction of the net amount (19 %).
VAT = 0.019


def with_vat(net):
    return round(net * (1 + VAT))
