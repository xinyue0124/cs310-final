##
## petrescue.py — Python test client for the Pet Rescue web service
## CS 310 Final Project, Winter 2026
##
## Usage examples (run from the client/ directory):
##   python3 petrescue.py ping
##   python3 petrescue.py pets
##   python3 petrescue.py external cat 5
##   python3 petrescue.py external dog 3
##   python3 petrescue.py listing mycat.jpg "Whiskers" "Siamese" 1.5 "Very playful"
##   python3 petrescue.py image 1
##   python3 petrescue.py subscribe you@email.com
##   python3 petrescue.py apply 1 "Jane Doe" "jane@email.com" "I love cats!"
##

import sys
import os
import base64
import requests
import json
import configparser

###########################################################################
# Load config
###########################################################################

config = configparser.ConfigParser()
config.read("petrescue-client-config.ini")

base_url = config['client']['webservice']


###########################################################################
# Helper
###########################################################################

def pretty(d):
    print(json.dumps(d, indent=2, default=str))


###########################################################################
# Commands
###########################################################################

def cmd_ping():
    r = requests.get(f"{base_url}/ping")
    pretty(r.json())


def cmd_pets():
    r = requests.get(f"{base_url}/pets")
    d = r.json()
    pretty(d)


def cmd_external(animal_type="cat", limit=10):
    r = requests.get(f"{base_url}/external_pets", params={"type": animal_type, "limit": limit})
    d = r.json()
    print(f"Status: {r.status_code}")
    print(f"Count: {d.get('count', 0)}")
    for pet in d.get("pets", []):
        print(f"  {pet['name']} ({pet['species']}) — {pet['breed']}")
    print()
    pretty(d)


def cmd_listing(photo_path, name, breed, age_years, description):
    if not os.path.exists(photo_path):
        print(f"ERROR: file not found: {photo_path}")
        return

    with open(photo_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    body = {
        "name":        name,
        "breed":       breed,
        "age_years":   float(age_years),
        "description": description,
        "data":        image_data
    }

    r = requests.post(f"{base_url}/listing", json=body)
    print(f"Status: {r.status_code}")
    pretty(r.json())


def cmd_image(petid):
    r = requests.get(f"{base_url}/image/{petid}")
    d = r.json()
    print(f"Status: {r.status_code}")
    if d.get("message") == "success":
        # Save the image to disk
        outfile = f"pet_{petid}.jpg"
        with open(outfile, "wb") as f:
            f.write(base64.b64decode(d["data"]))
        print(f"Image saved to {outfile}")
    else:
        pretty(d)


def cmd_subscribe(email):
    r = requests.post(f"{base_url}/subscribe", json={"email": email})
    print(f"Status: {r.status_code}")
    pretty(r.json())


def cmd_apply(petid, applicant_name, applicant_email, message=""):
    body = {
        "applicant_name":  applicant_name,
        "applicant_email": applicant_email,
        "message":         message
    }
    r = requests.post(f"{base_url}/apply/{petid}", json=body)
    print(f"Status: {r.status_code}")
    pretty(r.json())


###########################################################################
# Main
###########################################################################

if len(sys.argv) < 2:
    print("Usage: python3 petrescue.py <command> [args...]")
    print("Commands:")
    print("  ping")
    print("  pets")
    print("  external <cat|dog> [limit]")
    print("  listing <photo.jpg> <name> <breed> <age_years> <description>")
    print("  image <petid>")
    print("  subscribe <email>")
    print("  apply <petid> <name> <email> [message]")
    sys.exit(1)

command = sys.argv[1]

if command == "ping":
    cmd_ping()

elif command == "pets":
    cmd_pets()

elif command == "external":
    animal_type = sys.argv[2] if len(sys.argv) > 2 else "cat"
    limit       = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    cmd_external(animal_type, limit)

elif command == "listing":
    if len(sys.argv) < 7:
        print("Usage: listing <photo.jpg> <name> <breed> <age_years> <description>")
        sys.exit(1)
    cmd_listing(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])

elif command == "image":
    if len(sys.argv) < 3:
        print("Usage: image <petid>")
        sys.exit(1)
    cmd_image(sys.argv[2])

elif command == "subscribe":
    if len(sys.argv) < 3:
        print("Usage: subscribe <email>")
        sys.exit(1)
    cmd_subscribe(sys.argv[2])

elif command == "apply":
    if len(sys.argv) < 5:
        print("Usage: apply <petid> <name> <email> [message]")
        sys.exit(1)
    msg = sys.argv[5] if len(sys.argv) > 5 else ""
    cmd_apply(sys.argv[2], sys.argv[3], sys.argv[4], msg)

else:
    print(f"Unknown command: {command}")
    sys.exit(1)
