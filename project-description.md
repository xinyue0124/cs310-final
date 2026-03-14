# Animal Rescue Hub
**CS 310 — Scalable Software Architectures**  
**Winter 2026 — Final Project**  
**Student: Xinyue Zhang**

---

## 1. Project Overview

Animal Rescue Hub is a cloud-native web service designed to help small animal rescue
organizations increase visibility and connect adoptable animals with potential adopters.
The project was inspired by Paws and Claws Cat Rescue in Evanston, Illinois.

The application supports two user roles:
- **Rescue staff** — upload animal photos and create listings
- **Visitors** — browse animals, subscribe to alerts, and submit adoption applications

---

## 2. Architecture

![Architecture Diagram](architecture-diagram.png)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│   React SPA (served by Express)  +  Python CLI client        │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP (JSON)
┌────────────────────────▼────────────────────────────────────┐
│               Node.js / Express Web Service                  │
│                  (AWS Elastic Beanstalk)                      │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
Amazon     Amazon    Amazon      Amazon    The Cat API
  S3        RDS      Rekognition   SES     (external)
(photos)  (MySQL)   (species    (emails)  (breed data)
          pets/      detect)
          subscribers/
          applications
```

**Components:**

| Component | Purpose |
|---|---|
| Node.js / Express | Web service, routes HTTP requests |
| Amazon S3 | Stores pet photos uploaded by rescue staff |
| Amazon RDS (MySQL) | Stores pet listings, subscribers, adoption applications |
| AWS Rekognition | Auto-detects animal species from uploaded photos |
| Amazon SES | Sends new-pet alert emails and adoption confirmation emails |
| The Cat API | External API providing live cat breed data |

---

## 3. Three Non-Trivial Operations

### Non-Trivial #1 — External API Integration
**Endpoint:** `GET /external_pets`

The server makes a live HTTP request to **The Cat API** (`thecatapi.com`),
retrieves adoptable cat breed data (name, description, temperament, life span,
weight, intelligence rating, affection level, energy level, and a photo URL),
transforms the response into a unified schema, and returns it to the client.
No data is stored in our database — this is a pure real-time external API call.

### Non-Trivial #2 — Rekognition Species Detection + SES Subscriber Alert
**Endpoint:** `POST /listing`

When rescue staff uploads a pet photo and listing details:
1. The server base64-decodes the photo and uploads it to **Amazon S3**
2. The server calls **AWS Rekognition** `DetectLabels` on the S3 object, which returns
   a list of detected labels with confidence scores (e.g., "Cat: 97.5%", "Dog: 94.2%")
3. The server scans the labels for known species (Cat, Dog, Bird, Rabbit, etc.) and
   automatically sets the `species` field — the staff member does not type this manually
4. The pet record is inserted into **Amazon RDS (MySQL)**
5. The server queries all subscriber emails from the database and sends a new-pet
   alert email to each one via **Amazon SES**

### Non-Trivial #3 — Adoption Application + SES Confirmation Email
**Endpoint:** `POST /apply/:petid`

When a visitor submits an adoption application:
1. The server validates the `petid` exists in the database
2. The application (name, email, message) is inserted into the `applications` table
3. The server sends a personalized **Amazon SES** confirmation email to the applicant
   listing the pet's name, species, breed, and the applicant's message

---

## 4. API Reference

### GET /
**Description:** Health check — returns server status and uptime  
**Response 200:**
```json
{ "status": "running", "uptime_in_secs": 42 }
```

---

### GET /ping
**Description:** Returns count of photos in S3 (M) and pets in database (N)  
**Response 200:**
```json
{ "message": "success", "M": 12, "N": 6 }
```

---

### GET /external_pets
**Description:** Fetches live cat breed data from The Cat API (**Non-Trivial #1**)  
**Query Parameters:**
- `limit` — number of breeds to return (default: 10, max: 25)

**Response 200:**
```json
{
  "message": "success",
  "count": 10,
  "pets": [
    {
      "external_id": "J2qM5HR5K",
      "image_url": "https://cdn2.thecatapi.com/images/J2qM5HR5K.jpg",
      "species": "cat",
      "name": "Persian",
      "breed": "Persian",
      "description": "Persians are sweet, gentle cats...",
      "life_span": "14 - 15",
      "temperament": "Affectionate, loyal, Sedate, Quiet",
      "weight_kg": "4 - 6",
      "intelligence": 3,
      "affection_level": 5,
      "energy_level": 1,
      "source": "external"
    }
  ]
}
```
**Response 500:** `{ "message": "error message", "pets": [] }`

---

### GET /pets
**Description:** Returns all rescue-added pets from the database  
**Response 200:**
```json
{
  "message": "success",
  "count": 3,
  "pets": [
    {
      "petid": 1,
      "name": "Whiskers",
      "species": "cat",
      "breed": "Siamese",
      "age_years": 1.5,
      "description": "Playful and curious",
      "photo_key": "uuid.jpg",
      "source": "rescue",
      "created_at": "2026-03-14T06:42:18.000Z"
    }
  ]
}
```

---

### POST /listing  *(Non-Trivial #2)*
**Description:** Adds a rescue pet listing. Uploads photo to S3, auto-detects species
via Rekognition, inserts into database, emails all subscribers via SES.  
**Request Body (JSON):**
```json
{
  "name": "Buddy",
  "breed": "Golden Retriever",
  "age_years": 4.0,
  "description": "Friendly and great with kids",
  "data": "<base64-encoded JPEG>"
}
```
**Response 200:**
```json
{
  "message": "success",
  "petid": 7,
  "species": "dog",
  "rekognition_labels": [
    { "name": "Dog", "confidence": 99.1 },
    { "name": "Golden Retriever", "confidence": 92.3 }
  ],
  "subscribers_emailed": 2
}
```
**Response 400:** `{ "message": "name and data (base64 photo) are required" }`  
**Response 500:** `{ "message": "error message" }`

---

### GET /image/:petid
**Description:** Returns a pet's photo from S3 as a base64-encoded string  
**URL Parameter:** `petid` — pet's database ID  
**Response 200:**
```json
{ "message": "success", "petid": 7, "data": "<base64 string>" }
```
**Response 400:** `{ "message": "no such petid", "petid": -1 }`

---

### POST /subscribe
**Description:** Adds an email to the subscribers table  
**Request Body:** `{ "email": "you@example.com" }`  
**Response 200:**
```json
{ "message": "success", "subid": 3 }
```
**Response 200 (duplicate):** `{ "message": "already subscribed", "subid": -1 }`

---

### POST /apply/:petid  *(Non-Trivial #3)*
**Description:** Submits an adoption application. Inserts into database and sends
a SES confirmation email to the applicant.  
**URL Parameter:** `petid` — pet's database ID  
**Request Body (JSON):**
```json
{
  "applicant_name": "Jane Doe",
  "applicant_email": "jane@example.com",
  "message": "I have a large backyard and love dogs!"
}
```
**Response 200:**
```json
{ "message": "success", "appid": 5, "petid": 7, "email_sent": true }
```
**Response 400:** `{ "message": "no such petid" }`  
**Response 500:** `{ "message": "error message" }`

---

### POST /checkout
**Description:** Sends an SES inquiry email for a list of externally-browsed animals  
**Request Body (JSON):**
```json
{
  "applicant_name": "Jane Doe",
  "applicant_email": "jane@example.com",
  "message": "Interested in adopting!",
  "cats": [{ "name": "Persian", "breed": "Persian", "life_span": "14-15" }]
}
```
**Response 200:** `{ "message": "success", "email_sent": true, "cats_count": 1 }`

---

## 5. Database Schema

**Database:** `petrescue` on Amazon RDS (MySQL)

### Table: `pets`
Stores rescue-added animal listings.

| Column | Type | Description |
|---|---|---|
| `petid` | INT, AUTO_INCREMENT, PK | Unique pet identifier |
| `name` | VARCHAR(100), NOT NULL | Pet's name |
| `species` | VARCHAR(50) | Auto-detected by Rekognition (cat, dog, bird…) |
| `breed` | VARCHAR(100) | Breed, entered by staff |
| `age_years` | FLOAT | Age in years |
| `description` | TEXT | Free-text description |
| `photo_key` | VARCHAR(255) | S3 object key for the photo |
| `source` | VARCHAR(20) | Always `'rescue'` for staff-uploaded pets |
| `created_at` | TIMESTAMP | Auto-set on insert |

### Table: `subscribers`
Stores emails that receive new-pet alert notifications.

| Column | Type | Description |
|---|---|---|
| `subid` | INT, AUTO_INCREMENT, PK | Unique subscriber ID |
| `email` | VARCHAR(200), UNIQUE | Subscriber's email address |
| `created_at` | TIMESTAMP | Auto-set on insert |

### Table: `applications`
Stores adoption applications submitted by visitors.

| Column | Type | Description |
|---|---|---|
| `appid` | INT, AUTO_INCREMENT, PK | Unique application ID |
| `petid` | INT, FK → pets.petid | Which pet was applied for |
| `applicant_name` | VARCHAR(200) | Applicant's full name |
| `applicant_email` | VARCHAR(200) | Applicant's email |
| `message` | TEXT | Applicant's personal message |
| `created_at` | TIMESTAMP | Auto-set on insert |

---

## 6. Technologies Used

| Category | Technology |
|---|---|
| Language | JavaScript (Node.js), Python 3 |
| Web Framework | Express.js v5 |
| Frontend | React 18 (CDN), Bootstrap 5 |
| AWS Services | S3, RDS (MySQL), Rekognition, SES, Elastic Beanstalk |
| AWS SDK | @aws-sdk v3 (JavaScript) |
| External API | The Cat API (thecatapi.com) |
| HTTP Client | axios (Node.js), requests (Python) |
| Retry Logic | p-retry (Node.js) |
| Database Driver | mysql2/promise |
| Config | .ini files parsed with `ini` package |
