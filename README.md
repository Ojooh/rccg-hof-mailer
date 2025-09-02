
# RCCG HoF Mailer

**Version:** 0.0.1
**Description:** A simple Node.js app for House of Favour that fetches data from Google Forms responses and sends emails to community members.

## Features

* Fetches member data from Google Forms / Google Sheets.
* Sends personalized emails using `nodemailer`.
* Maintains local JSON storage for members, email templates, and sent emails.
* Simple modular architecture for easy extension.

## Installation

```bash
git clone https://github.com/ojooh/rccg-hof-mailer
cd rccg-hof-mailer
npm install
```

## Usage

1. Configure email settings and templates in `local_db/email_templates.json`.
2. Add your Google Sheets / Forms credentials if required.
3. Run the mailer:

```bash
node modules/email_enqueuer.js
```

or execute specific modules like `email_sender.js` for targeted operations.

## File Structure Overview

```
rccg-hof-mailer/
├─ enums/                 # Constants for app configuration
├─ local_db/              # JSON storage for emails and member data
├─ modules/               # Core logic (fetching, processing, sending emails)
├─ logs/                  # Runtime logs
├─ node_modules/          # Dependencies
└─ package.json           # Project metadata and dependencies
```

## Dependencies

* [Node.js](https://nodejs.org/)
* [nodemailer](https://www.npmjs.com/package/nodemailer)
* [axios](https://www.npmjs.com/package/axios)
* [csv-parser](https://www.npmjs.com/package/csv-parser)

## Contributing

* Fork the repository
* Create a feature branch
* Submit a pull request with your changes

## License

MIT License
