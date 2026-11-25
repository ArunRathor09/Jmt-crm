# JMT-CRM – Travel Management & Sales CRM

A modern Travel Agency CRM built with Next.js to manage customer relationships, sales leads, bookings, quotations, and domestic and international tour packages.

JMT-CRM simplifies travel business operations by providing a centralized platform for managing customers, sales activities, travel packages, and customized itineraries.

## Key Features

### Dashboard
- Business performance overview
- Total leads, customers, and bookings
- Revenue and sales analytics
- Booking and enquiry statistics

### Customer & Lead Management
- Customer profile management
- Travel enquiry management
- Lead assignment to sales executives
- Lead source and status tracking
- Customer interaction history
- Near-real-time Dubai Meta Ads lead sync from Google Sheets ([setup guide](./docs/google-sheets-dubai-sync.md))

### Sales CRM
- Sales pipeline management
- Lead follow-up reminders
- Sales executive management
- Deal and conversion tracking
- Sales performance reports

### Tour Package Management
- Domestic tour packages
- International tour packages
- Customized travel packages
- Destination and hotel management
- Package pricing and inclusions
- Package availability management

### Itinerary Management
- Customized day-wise itineraries
- Multiple destination management
- Activities and sightseeing details
- Hotel accommodation management
- Transportation details
- Personalized travel plans

### Quotation & Booking Management
- Customer quotation generation
- Booking confirmation management
- Advance and pending payment tracking
- Booking history
- Invoice and travel document management

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack application framework |
| React.js | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Responsive styling |
| PostgreSQL | Database |
| Prisma ORM | Database management |

## Project Structure

```text
JMT-CRM/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── utils/
├── prisma/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/arunjmt96-arch/JMT-CRM.git
```

### 2. Navigate to Project

```bash
cd JMT-CRM
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory.

```env
DATABASE_URL="your_postgresql_connection_string"
```

Configure other environment variables required by your application.

### 5. Run Development Server

```bash
npm run dev
```

Open your browser and navigate to:

```text
http://localhost:3000
```

## Project Goals

- Simplify travel agency operations.
- Improve lead conversion and sales tracking.
- Centralize customer information.
- Streamline tour package management.
- Simplify itinerary creation.
- Improve booking and payment management.
- Enhance customer experience.

## Future Enhancements

- WhatsApp integration
- Automated email notifications
- PDF itinerary generation
- PDF quotation generation
- Payment gateway integration
- Role-based access control
- Advanced sales analytics
- B2B travel agent portal
- Customer booking portal

## Developer

**JMT-CRM**

GitHub Repository: https://github.com/arunjmt96-arch/JMT-CRM

## License

This project is maintained as a private development project. Usage and distribution terms will be defined by the repository owner.

---

JMT-CRM – Simplifying Travel Business Management.
