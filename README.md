# Content Hub

A web content subscription service that enables easy monitoring of any website for updates with periodic notifications and AI-powered summaries.

## Overview

Content Hub allows users to subscribe to any website (not just RSS feeds) and automatically monitors for new content using cron jobs and LLM-based diff detection. When new content is detected, users receive notifications with AI-generated summaries.

## Architecture

### Components

1. **Chrome Extension**
   - One-click subscription to any website
   - Seamless integration with the local server
   - User-friendly interface for managing subscriptions

2. **Local Server** (TypeScript/Node.js)
   - RESTful API for subscription management
   - Cron job scheduler for periodic content checking
   - LLM integration for content diff detection
   - Database for storing subscriptions and content history
   - Notification service

## Features

- **Universal Website Support**: Subscribe to any website, not limited to RSS feeds
- **Smart Content Detection**: Uses LLM to intelligently detect meaningful content changes
- **AI-Powered Summaries**: Automatically generates summaries of new content
- **Flexible Notifications**: Customizable notification preferences and schedules
- **Local-First Architecture**: Runs on your local machine for privacy and control

## Tech Stack

- **Backend**: TypeScript, Node.js, Express
- **Database**: SQLite/PostgreSQL
- **Chrome Extension**: TypeScript, Chrome Extension API
- **LLM Integration**: OpenAI API / Local LLM
- **Job Scheduling**: node-cron
- **Web Scraping**: Puppeteer/Playwright

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Chrome browser
- OpenAI API key (or local LLM setup)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/contents-hub.git
cd contents-hub
```

2. Install server dependencies
```bash
cd server
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server
```bash
npm run dev
```

5. Load Chrome extension
- Open Chrome and navigate to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `extension` directory

## Usage

1. Navigate to any website you want to monitor
2. Click the Content Hub extension icon
3. Click "Subscribe to this page"
4. Configure monitoring frequency and notification preferences
5. Receive notifications when new content is detected

## Project Structure

```
contents-hub/
├── server/               # Local server application
│   ├── src/
│   │   ├── api/         # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── scrapers/    # Web scraping modules
│   │   ├── llm/         # LLM integration
│   │   ├── jobs/        # Cron job definitions
│   │   └── db/          # Database models
│   └── package.json
├── extension/           # Chrome extension
│   ├── src/
│   │   ├── background/  # Background scripts
│   │   ├── content/     # Content scripts
│   │   └── popup/       # Extension popup UI
│   └── manifest.json
└── README.md
```

## Development Roadmap

- [ ] Basic server setup with TypeScript
- [ ] Chrome extension scaffold
- [ ] Website scraping functionality
- [ ] LLM integration for diff detection
- [ ] Cron job implementation
- [ ] Notification system
- [ ] User interface for subscription management
- [ ] Support for multiple LLM providers
- [ ] Advanced content filtering rules
- [ ] Export/Import subscriptions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.