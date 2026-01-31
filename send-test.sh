#!/bin/bash

# Simple test script to send an email through the SMTP relay
# Usage: ./send-test.sh recipient@example.com "Subject" "Body"

if [ "$#" -lt 3 ]; then
    echo "Usage: ./send-test.sh <recipient@example.com> <subject> <body>"
    echo "Example: ./send-test.sh john@example.com \"Test Subject\" \"Test message\""
    exit 1
fi

RECIPIENT=$1
SUBJECT=$2
BODY=$3

echo "Sending test email..."
echo "To: $RECIPIENT"
echo "Subject: $SUBJECT"
echo ""

npm test "$RECIPIENT" "$SUBJECT" "$BODY"
