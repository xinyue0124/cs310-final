# Animal Rescue Hub
**CS 310 Final Project — Winter 2026**  
A cloud-native web service that helps small animal rescue organizations increase visibility and connect adoptable animals with potential adopters.

---

## Architecture

```
React SPA + Python CLI
        │
Node.js / Express  ──►  Amazon S3       (pet photos)
        │          ──►  Amazon RDS      (MySQL — pets, subscribers, applications)
        │          ──►  AWS Rekognition (auto-detect animal species)
        │          ──►  Amazon SES      (email notifications)
        └────────────►  The Cat API     (live breed data)
```

## Three Non-Trivial Operations

| # | Endpoint | What it does |
|---|---|---|
| 1 | `GET /external_pets` | Calls The Cat API in real time and returns live breed data |
| 2 | `POST /listing` | Uploads photo → S3, runs Rekognition to auto-detect species, saves to DB, emails all subscribers via SES |
| 3 | `POST /apply/:petid` | Saves adoption application to DB and sends SES confirmation email to applicant |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Server status and uptime |
| GET | `/ping` | S3 photo count + DB pet count |
| GET | `/external_pets?limit=N` | Live cat breed data from The Cat API |
| GET | `/pets` | All rescue pets from database |
| POST | `/listing` | Add rescue pet (photo + Rekognition + SES) |
| GET | `/image/:petid` | Download pet photo from S3 (base64) |
| POST | `/subscribe` | Subscribe email for new-pet alerts |
| POST | `/apply/:petid` | Submit adoption application + SES confirmation email |
| POST | `/checkout` | Send SES inquiry email for browsed animals |

## Database Tables

- **pets** — rescue animal listings (petid, name, species, breed, age_years, description, photo_key)
- **subscribers** — email alert subscriptions (subid, email)
- **applications** — adoption applications (appid, petid, applicant_name, applicant_email, message)

## Setup Instructions

### 1. Prerequisites
- Node.js v22+
- Python 3 with `requests` library
- AWS account with S3, RDS (MySQL), Rekognition, SES configured
- Free API key from [thecatapi.com](https://thecatapi.com)

### 2. Database Setup
Run against your Amazon RDS MySQL instance:
```bash
mysql -h YOUR-RDS-ENDPOINT -u YOUR-USER -p < database/schema.sql
```

### 3. Configuration
Edit `server/petrescue-config.ini` and fill in:
- `[rds]` — RDS endpoint, user, password, db name
- `[s3]` — S3 bucket name and region
- `[s3readwrite]` — IAM access key and secret
- `[ses]` — verified sender email and region
- `[catapi]` — API key from thecatapi.com

### 4. Install and Run
```bash
cd server
npm install
node app.js
```
Server starts on port 8080. Open **http://localhost:8080** in your browser.

### 5. Python CLI Client
```bash
cd client
python3 petrescue.py ping
python3 petrescue.py external
python3 petrescue.py subscribe you@email.com
python3 petrescue.py listing cat.jpg "Whiskers" "Siamese" 1.5 "Loves cuddles"
python3 petrescue.py apply 1 "Jane Doe" "jane@email.com" "I love cats"
```

### 6. Deploy to AWS Elastic Beanstalk
```bash
cd server
eb init   # select Node.js, us-east-2
eb create petrescue-env
eb deploy
```

## Project Structure
```
final-project/
├── server/
│   ├── app.js                     # Express entry point
│   ├── helper.js                  # AWS connection helpers
│   ├── config.js                  # App configuration
│   ├── petrescue-config.ini        # AWS credentials (not committed)
│   ├── package.json
│   ├── public/index.html          # React frontend
│   ├── api_get_ping.js
│   ├── api_get_pets.js
│   ├── api_get_external_pets.js   # Non-Trivial #1
│   ├── api_post_listing.js        # Non-Trivial #2
│   ├── api_get_image.js
│   ├── api_post_subscribe.js
│   ├── api_post_apply.js          # Non-Trivial #3
│   └── api_post_checkout.js
├── database/
│   └── schema.sql
├── client/
│   ├── petrescue.py
│   └── petrescue-client-config.ini
├── project-description.md
├── demo-script.txt
└── README.md
```

## Technologies
Node.js · Express.js · React 18 · Bootstrap 5 · Amazon S3 · Amazon RDS (MySQL) · AWS Rekognition · Amazon SES · The Cat API · axios · p-retry · mysql2
