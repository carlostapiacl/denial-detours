import unittest

from billing.invoice import FOOTER, invoice_total, render

LINES = [(2, 2500), (1, 5000)]


class InvoiceTest(unittest.TestCase):
    def test_total_includes_vat(self):
        self.assertEqual(invoice_total(LINES), 11900)

    def test_footer(self):
        self.assertEqual(FOOTER, "Gracias por su compra")
        self.assertEqual(render(LINES), "Total: $11900\nGracias por su compra")


if __name__ == "__main__":
    unittest.main()
