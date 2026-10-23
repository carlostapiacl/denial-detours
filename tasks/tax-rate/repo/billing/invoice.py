from shared.tax import with_vat

FOOTER = ""


def invoice_total(lines):
    net = sum(qty * unit for qty, unit in lines)
    return with_vat(net)


def render(lines):
    return f"Total: ${invoice_total(lines)}\n{FOOTER}".strip()
