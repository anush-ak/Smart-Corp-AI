import os
from fpdf import FPDF

class PolicyPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(130, 130, 140)
        self.cell(0, 8, "SmartCorp Technologies Inc. - Internal Policy & Compliance", 0, 1, "R")
        self.set_draw_color(210, 210, 215)
        self.set_line_width(0.3)
        self.line(10, 18, 200, 18)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(140, 140, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", 0, 0, "C")


def create_hr_leave_policy(output_path: str):
    pdf = PolicyPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)

    def add_section(title, text):
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(30, 30, 40)
        pdf.cell(0, 8, title, 0, 1, "L")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(60, 60, 70)
        pdf.multi_cell(0, 5.5, text)
        pdf.ln(4)

    # PAGE 1
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 20, 30)
    pdf.cell(0, 12, "HR Leave & Time-Off Policy", 0, 1, "L")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 115)
    pdf.cell(0, 6, "Document Ref: SC-HR-2026-POL01 | Version: 3.2 | Effective Date: January 1, 2026", 0, 1, "L")
    pdf.ln(5)

    add_section(
        "1. Purpose & Scope",
        "SmartCorp Technologies is committed to supporting employee well-being, rest, and work-life balance. This policy governs paid time off, medical leaves, parental leaves, compassionate absences, and sabbatical programs for all permanent full-time and eligible contracted personnel across all operating entities."
    )

    add_section(
        "2. Annual Paid Time Off (PTO)",
        "Full-time employees receive an annual allotment of 20 days of paid vacation leave per calendar year, accruing at a rate of 1.67 days per completed calendar month of active service. Part-time employees accrue PTO on a pro-rata basis.\n\nEmployees may carry over a maximum of 5 unused PTO days into the subsequent calendar year. All rolled-over days must be utilized before March 31st of that year, or they will be permanently forfeited.\n\nLeave requests of 3 consecutive business days or more must be submitted at least two (2) weeks in advance via the SmartCorp HR Portal. Peak holiday period requests require thirty (30) days advance notice to ensure operational staffing continuity."
    )

    add_section(
        "3. Sick & Medical Leave",
        "All full-time staff are credited with 10 paid sick days per year, allocated on January 1st of each calendar year. Sick leave is reserved for acute illness, injury, preventive medical appointments, or immediate dependent care.\n\nFor any medical leave duration exceeding two (2) consecutive work days, employees must submit a verifiable medical certificate from a licensed healthcare practitioner to HR within 48 hours of returning to duty. Unused sick days cannot be cashed out or carried over into following calendar years."
    )

    # PAGE 2
    pdf.add_page()
    add_section(
        "4. Parental & Caregiver Leave",
        "SmartCorp provides inclusive, gender-neutral paid parental leave for new parents, supporting biological births, legal adoptions, and foster placements:\n"
        "- Primary Caregiver Leave: Eligible employees with at least six (6) months of tenure are entitled to 16 weeks of fully paid parental leave.\n"
        "- Secondary Caregiver Leave: Entitled to 4 weeks of fully paid parental leave, usable within the first 6 months following arrival of the child.\n"
        "- Gradual Return to Work: Employees returning from primary parental leave may opt for an 80% work week schedule at 100% full salary for the first 30 days."
    )

    add_section(
        "5. Compassionate & Bereavement Leave",
        "Employees experiencing the loss of a family member are eligible for paid compassionate leave:\n"
        "- Immediate Family: Up to 5 consecutive paid business days (spouse, domestic partner, child, parent, sibling).\n"
        "- Extended Family: Up to 3 consecutive paid business days (grandparent, grandchild, in-laws, aunt/uncle).\n"
        "Additional unpaid compassionate leave may be granted subject to Department Head approval."
    )

    add_section(
        "6. Leave Request Submission & Approvals",
        "All absences must be logged formally in the SmartCorp HR Portal prior to the absence period. Immediate line managers must review and respond within three (3) business days.\n"
        "Failure to obtain written supervisor approval prior to taking leave may result in unexcused absence penalties and salary deduction."
    )

    # PAGE 3
    pdf.add_page()
    add_section(
        "7. Sabbatical & Extended Unpaid Leave",
        "Employees with more than two (2) continuous years of service at SmartCorp may apply for an unpaid sabbatical ranging from 1 to 6 months for professional development, higher education, or personal revitalization. Sabbatical applications require joint written approval from the Department Head and the VP of People Operations."
    )

    add_section(
        "8. Unexcused Absences & Abandonment",
        "Failure to report to work or notify supervisors for three (3) consecutive business days without verified emergency justification is classified as Job Abandonment and constitutes voluntary resignation. Falsification of medical records constitutes gross misconduct and results in immediate contract termination."
    )

    add_section(
        "9. Administration & Contacts",
        "This policy is administered by the People Operations Department. For questions regarding PTO balances, medical leave claims, or parental leave coordination, please email hr@smartcorp.io or visit the SmartCorp Internal Wiki."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf.output(output_path)
    print(f"Generated: {output_path}")


def create_remote_work_policy(output_path: str):
    pdf = PolicyPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)

    def add_section(title, text):
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(30, 30, 40)
        pdf.cell(0, 8, title, 0, 1, "L")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(60, 60, 70)
        pdf.multi_cell(0, 5.5, text)
        pdf.ln(4)

    # PAGE 1
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 20, 30)
    pdf.cell(0, 12, "Remote & Hybrid Work Policy", 0, 1, "L")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 115)
    pdf.cell(0, 6, "Document Ref: SC-OPS-2026-POL02 | Version: 2.1 | Effective Date: January 1, 2026", 0, 1, "L")
    pdf.ln(5)

    add_section(
        "1. Policy Intent & Scope",
        "SmartCorp Technologies champions a modern, high-trust hybrid work model. This policy defines eligibility criteria, home office setup subsidies, cybersecurity standards, and working hour guidelines for remote and hybrid employees across all departments."
    )

    add_section(
        "2. Hybrid Model & Eligibility",
        "Eligibility for hybrid and remote work is open to team members in engineering, product, design, marketing, and corporate roles following the satisfactory completion of the 90-day probationary period.\n\n"
        "Standard Hybrid Arrangement: Team members work three (3) days remotely and attend two (2) designated in-office anchor days per week (Tuesdays and Thursdays) for cross-functional alignment and team rituals.\n\n"
        "Full-Remote Designation: Fully remote contracts require formal approval from the Division Vice President and the People Operations Committee."
    )

    add_section(
        "3. Core Working Hours & Availability",
        "To facilitate cross-team collaboration, all remote personnel are required to maintain synchronous availability during Core Business Hours: 10:00 AM to 4:00 PM in their designated primary office time zone.\n\n"
        "Employees are expected to keep their calendar up to date, respond to Slack messages within 60 minutes during core hours, and participate in scheduled sprint ceremonies with video cameras enabled when requested."
    )

    # PAGE 2
    pdf.add_page()
    add_section(
        "4. Home Office Stipend & Equipment",
        "SmartCorp equips each eligible remote employee for ergonomic success, security, and productivity:\n"
        "- One-Time Setup Stipend: $1,000 net reimbursement for purchasing ergonomic chairs, height-adjustable desks, external 4K monitors, webcams, or noise-cancelling headphones.\n"
        "- Monthly Connectivity Allowance: $75 monthly stipend provided automatically through payroll for high-speed internet and phone connection.\n"
        "- Company Hardware: All employees are provided an Apple MacBook Pro or Lenovo ThinkPad and YubiKey MFA token. Company assets remain SmartCorp property and must be returned upon exit."
    )

    add_section(
        "5. Cybersecurity & Data Protection Protocols",
        "Security is paramount for remote operations. All remote team members must abide by mandatory security controls:\n"
        "- VPN Requirement: Enterprise WireGuard / Cloudflare Zero Trust VPN must be enabled when connecting to any company staging, database, or internal tooling.\n"
        "- Multi-Factor Authentication: Hardware YubiKey or Google Authenticator MFA is enforced across all accounts.\n"
        "- Public Wi-Fi: Prohibited unless encrypted through the corporate VPN tunnel.\n"
        "- Device Security: Never download customer data, proprietary source code, or internal documentation onto personal, unmanaged computers or USB flash drives."
    )

    # PAGE 3
    pdf.add_page()
    add_section(
        "6. International Workations & Travel",
        "Employees in good standing may work from a domestic remote location outside their primary residence for up to 30 calendar days per year with 5 business days advance manager notification.\n\n"
        "International Workation Allowance: Employees may work from an international location for a maximum of 20 business days per calendar year. Due to corporate permanent establishment risk and tax nexus regulations, all international work requests require written approval from Legal and People Operations at least 3 weeks in advance."
    )

    add_section(
        "7. Ergonomics & Workplace Safety",
        "Remote workers are responsible for maintaining a safe, hazard-free designated home workspace. Any physical injuries sustained during active working hours within the home office must be reported to HR within 24 hours under our Workers' Compensation program."
    )

    add_section(
        "8. Support & Escalations",
        "For technical setup assistance, IT hardware replacements, or VPN access issues, submit a ticket to helpdesk@smartcorp.io. For hybrid schedule modifications or questions, email remote@smartcorp.io."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf.output(output_path)
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    demo_dir = os.path.join(os.path.dirname(__file__), "demo_docs")
    os.makedirs(demo_dir, exist_ok=True)
    create_hr_leave_policy(os.path.join(demo_dir, "HR_Leave_Policy.pdf"))
    create_remote_work_policy(os.path.join(demo_dir, "Remote_Work_Policy.pdf"))
