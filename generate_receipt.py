from fpdf import FPDF

class ReceiptPDF(FPDF):
    def create_receipt(self, data):
        self.add_page()
        self.set_margin(20)
        
        # Header
        self.set_font("Arial", 'B', 14)
        self.cell(0, 7, "SYDENHAM AFTER SCHOOL CLUB", ln=True, align='C')
        self.set_font("Arial", '', 9)
        self.cell(0, 5, "105 Sydenham Road, London, SE26 5UA Tel: 020 3621 3942", ln=True, align='C')
        self.cell(0, 5, "Ofsted Registration No: EY493436", ln=True, align='C')
        
        self.ln(5)
        self.set_font("Arial", 'B', 12)
        self.cell(0, 10, "RECEIPT - Parent Top-Up Payment", ln=True, align='C')
        self.ln(5)

        # Parent/Child Details
        self.set_font("Arial", '', 11)
        self.cell(0, 7, f"Parent/Guardian: {data['parent']}", ln=True)
        self.cell(0, 7, f"Child(ren): {data['child']}", ln=True)
        self.cell(0, 7, f"Period Covered: {data['period']}", ln=True)
        self.cell(0, 7, f"Invoice No: {data['invoice_no']}", ln=True)
        self.ln(10)

        # Table Header
        self.set_font("Arial", 'B', 11)
        self.cell(120, 10, "Description", border=1)
        self.cell(40, 10, "Amount (GBP)", border=1, ln=True, align='C')

        # Table Rows
        self.set_font("Arial", '', 11)
        rows = [
            ("Total Childcare Fees", data['total_fees']),
            ("SFL Contribution (85%)", data['sfl_contrib']),
            ("Parent Top-Up (15%)", data['top_up']),
            ("Amount Received", data['top_up'])
        ]
        
        for i, (desc, amt) in enumerate(rows):
            # Bold the last row
            if i == 3: self.set_font("Arial", 'B', 11)
            self.cell(120, 10, desc, border=1)
            self.cell(40, 10, f"{amt:,.2f}", border=1, ln=True, align='R')

        # Payment Method Section
        self.ln(10)
        self.set_font("Arial", '', 11)
        self.write(7, "Payment Method (circle one): ")
        self.set_font("Arial", 'U', 11)
        self.write(7, "  cash  ")
        self.set_font("Arial", '', 11)
        self.write(7, "  Received")
        self.ln(10)

        # Payment Options Box
        self.set_font("Arial", 'B', 11)
        self.cell(0, 7, "Payment Options:", ln=True)
        self.set_font("Arial", '', 10)
        self.cell(0, 6, "  * Cash - Payable at the club reception", ln=True)
        self.cell(0, 6, "  * Bank Transfer - Sydenham After School Club, Sort Code: 09-01-29, Account No: 32638392", ln=True)
        self.cell(0, 6, "  * Card Payment - Available at the club", ln=True)
        
        # Footer
        self.ln(10)
        self.set_font("Arial", 'I', 10)
        self.cell(0, 7, "Notes: Thank you for your payment. Please retain this receipt for your records.", ln=True)
        self.ln(5)
        self.set_font("Arial", 'B', 11)
        self.cell(0, 7, f"Date: {data['receipt_date']}", ln=True)

# Data for Receipt 002
receipt_data = {
    "parent": "Anca Mihaela Toala",
    "child": "David Andrei",
    "period": "06/10/2025 to 02/11/2025",
    "invoice_no": "002",
    "total_fees": 920.00,
    "sfl_contrib": 782.00,
    "top_up": 138.00,
    "receipt_date": "03/11/2025"
}

pdf = ReceiptPDF()
pdf.create_receipt(receipt_data)
pdf.output("Receipt_002.pdf")
