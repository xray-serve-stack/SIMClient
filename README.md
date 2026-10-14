# SIM Client

SIM Client is a messaging client inspired by Google Messages, built to explore and implement messaging behavior through a customizable client-server architecture.

## Features

- **Messaging UI:** A messaging experience inspired by Google Messages.
- **IndexedDB Cache:** Local storage for conversations and messages, with related application data.
- **SIM Management:** Support for working with multiple SIM subscriptions.
- **Custom Protocol:** A client-server communication protocol that can be adapted for personal projects.

## Architecture

The client uses IndexedDB to store locally cached data in the following object stores:

- `contacts` — Contact data
- `conversations` — Conversation data
- `messages` — Message data
- `meta` — Application metadata
- `serves` — Serve-related data
- `sims` — SIM subscription data

The client communicates with the server through the project's messaging protocol. Developers can customize the protocol and adapt the client to their own server implementation.

For protocol changes, review the relevant message definitions and their corresponding client-side request and response handling.

## Getting Started

### Requirements

- Node.js
- npm

### Installation

Clone the repository and enter the project directory:

```bash
git clone <REPOSITORY_URL>
cd SIMClient
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

## Customization

SIM Client is intended to be adaptable. You can modify the UI, local caching behavior, or communication protocol to suit your own project.

Before changing the protocol, ensure that the client and the corresponding server-side implementations remain compatible.

## License

No license has been specified yet.