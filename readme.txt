Pet Rescue Web Service
CS 310 Final Project — Winter 2026
=====================================

OVERVIEW
--------
A cloud-native web service for a pet rescue organization (inspired by Paws and Claws
Cat Rescue in Evanston, IL). The server lets rescues add pet listings with photos,
potential adopters browse pets (both local rescue pets and from live external APIs),
subscribe to new-pet email alerts, and submit adoption applications.

ARCHITECTURE
------------
  Node.js / Express server  →  AWS Elastic Beanstalk (port 8080)
  Amazon RDS (MySQL)         →  pets, subscribers, applications tables
  Amazon S3                  →  pet photo storage
  AWS Rekognition            →  auto-detect animal species from uploaded photo
  Amazon SES                 →  new-pet alert emails + adoption confirmation emails
  The Cat API / The Dog API  →  external adoptable pet data (no database needed)

THREE NON-TRIVIAL OPERATIONS
-----------------------------
  1. GET /external_pets  — calls The Cat API or The Dog API in real time and
                           returns adoptable pet data in a unified JSON schema.

  2. POST /listing       — rescue staff uploads a pet photo and details; the server
                           stores the photo in S3, calls Rekognition to auto-tag the
                           species, saves the record to MySQL, and emails every
                           subscriber via SES to announce the new pet.

  3. POST /apply/:petid  — a potential adopter submits an application; the server
                           saves it to MySQL and sends an SES confirmation email
                           to the applicant.

API SUMMARY
-----------
  GET  /ping                 → health check (S3 count + DB pet count)
  GET  /pets                 → all rescue-added pets from DB
  GET  /external_pets        → live data from The Cat API / The Dog API
                               ?type=cat|dog  &limit=N
  POST /listing              → add rescue pet (photo + Rekognition + SES)
                               body: { name, breed, age_years, description, data (base64) }
  GET  /image/:petid         → download pet photo (base64) from S3
  POST /subscribe            → add email to subscriber list
                               body: { email }
  POST /apply/:petid         → submit adoption application + SES confirmation email
                               body: { applicant_name, applicant_email, message }

SETUP INSTRUCTIONS
------------------
1. DATABASE
   - Create or reuse your Amazon RDS MySQL instance.
   - Run:  mysql -h <endpoint> -u <user> -p < database/schema.sql
   - This creates the petrescue database with pets, subscribers, applications tables.

2. S3
   - Create (or reuse) an S3 bucket.  Make it private.

3. REKOGNITION
   - No setup needed; uses the same AWS credentials as S3.
   - Make sure your IAM user has rekognition:DetectLabels permission.

4. SES EMAIL
   - In the AWS SES console (us-east-2), verify your sender email address.
   - While in sandbox mode, also verify any recipient email you want to test with.
   - Add the verified email as sender_email in petrescue-config.ini.

5. EXTERNAL APIS
   - The Cat API: sign up free at https://thecatapi.com  → copy your API key.
   - The Dog API: sign up free at https://thedogapi.com  → copy your API key.
   - Add both keys to petrescue-config.ini under [catapi] and [dogapi].

6. CONFIG FILE (server/petrescue-config.ini)
   Fill in all YOUR-* placeholders:
     [rds]      — RDS endpoint, user, password, db name
     [s3]       — bucket name, region
     [s3readwrite] — IAM access key / secret
     [ses]      — verified sender email, region
     [catapi]   — API key from thecatapi.com
     [dogapi]   — API key from thedogapi.com

7. INSTALL DEPENDENCIES  (from server/ directory)
     npm install

8. RUN LOCALLY
     node app.js
   Server starts on port 8080.

9. TEST WITH CLIENT
   From the client/ directory:
     python3 petrescue.py ping
     python3 petrescue.py external cat 5
     python3 petrescue.py subscribe you@example.com
     python3 petrescue.py listing myphoto.jpg "Luna" "Siamese" 2.0 "Loves cuddles"
     python3 petrescue.py apply 1 "Jane Doe" "jane@example.com" "I love cats!"
   (Edit client/petrescue-client-config.ini to point at your server URL.)

10. DEPLOY TO ELASTIC BEANSTALK (same as Project 02 / Lab 03)
    eb init  (select Node.js platform, us-east-2)
    eb create petrescue-env
    eb deploy
