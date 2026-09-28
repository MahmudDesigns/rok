# Food Donation Management System for the Government of Kenya

A centralized web-based platform for managing food donations, food inventory, beneficiary registration, distribution, and reporting for government food relief programmes.

## The Problem

Food relief in Kenya during droughts, floods, and other emergencies is still largely managed manually. This leads to:
- **Manual record keeping** — beneficiary and inventory records on paper are hard to retrieve and vulnerable to loss or damage.
- **Slow distribution** — verifying beneficiaries and allocating food takes too long.
- **Lack of transparency** — hard to track food from warehouse to beneficiary, increasing the risk of misuse.
- **Poor inventory management** — stock levels are unclear, causing shortages or wastage.
- **Inaccurate reporting** — manually prepared reports are slow and error-prone.
- **Duplicate beneficiaries** — no central database means some people receive food multiple times while others are missed.
- **Limited access to information** — beneficiaries can't easily learn about food availability or schedules.

## What This System Does

- **Beneficiary registration** — electronic, centralized records to prevent duplication.
- **Food stock registration & inventory management** — track stock supplied by the Government of Kenya, updated automatically after each distribution.
- **Food allocation & distribution tracking** — fair allocation with automatically generated distribution records.
- **Reporting** — food stock, beneficiaries served, food distributed, and remaining inventory.
- **User authentication & management** — secure login for authorized government officers.
- **Notifications** — distribution schedules and collection points sent to beneficiaries.

## Users

- Government officers (national and county level)
- Food warehouse managers/staff
- Registered beneficiaries
- Partnering humanitarian organizations

## Requirements

**Functional:** register beneficiaries and government food supplies, manage inventory, allocate food, track distribution, generate reports, manage users, authenticate securely, monitor stock levels, send collection notifications.

**Non-functional:** secure, reliable, easy to use, fast, scalable, data-integrity preserving, with regular database backups.

## Scope

**Included:** beneficiary registration, government food stock registration, inventory management, food allocation, distribution tracking, user management, report generation, notification management.

**Excluded:** general humanitarian-aid features beyond food donation coordination, such as cash-transfer processing or public donor-facing fundraising.

## Tech Stack

Originally scoped for HTML5, CSS3, JavaScript, PHP, and MySQL (developed locally using XAMPP).

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd food-donation-ms

# Install dependencies (if applicable to your stack)
npm install

# Configure environment variables (database credentials, etc.)
cp .env.example .env

# Set up the database and run migrations
# (command depends on your stack — e.g. import the provided SQL file into MySQL,
#  or run your ORM's migration command)

# Start the development server
npm run dev
```

If running the PHP/MySQL version locally: install XAMPP, place the project in the `htdocs` folder, start Apache and MySQL from the XAMPP control panel, import the database SQL file via phpMyAdmin, then open `http://localhost/food-donation-ms` in your browser.

## Development Approach

Built using the Waterfall model: requirements gathering, analysis, design, coding, testing, implementation, and maintenance.

## Limitations

Financial and time constraints, restricted access to official government data, unreliable internet connectivity in some regions (as the system is web-based), and potential user resistance to moving away from manual processes.

## Author

Brian Wachira Wangari — Mount Kenya University, School of Computing and Informatics.
Supervisor: Kevin Njagi.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
