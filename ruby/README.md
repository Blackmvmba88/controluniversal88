# Ruby Implementation with ryby gem

This directory contains the Ruby/Sinatra implementation of ControlUniversal with the [ryby gem](https://rubygems.org/gems/ryby) package.

## About ryby gem

The `ryby` (also known as "Ryba") gem is a Russian language data generator, similar to Faker but specifically designed for generating Russian names, addresses, phone numbers, and company names. While it's included in this project's dependencies, it serves as a demonstration of Ruby gem integration with the ControlUniversal project.

## Quick Start

### Installation

```bash
# Install dependencies
bundle install
```

### Running the Server

```bash
# With simulation mode (no hardware required)
SIMULATE=1 bundle exec ruby ruby/server.rb

# With actual DualShock 4 controller
bundle exec ruby ruby/server.rb
```

Open your browser to http://localhost:8080 to see the WebUI.

### Running the Daemon Only

```bash
# Test the daemon in simulation mode
SIMULATE=1 bundle exec ruby ruby/daemon.rb
```

## Files

- **server.rb** - Main Sinatra web server with WebSocket support
- **daemon.rb** - Controller input daemon that reads HID events

## Features

- ✅ WebSocket streaming of controller events
- ✅ REST API endpoints for status
- ✅ Simulation mode for development/testing
- ✅ Compatible with the same WebUI as Node.js and Python implementations
- ✅ Includes ryby gem dependency

## API Endpoints

### GET /api/status
Returns server status and configuration.

Example response:
```json
{
  "status": "ok",
  "ruby_version": "3.2.3",
  "ryby_gem": "loaded",
  "simulate": true
}
```

### WebSocket /ws
Connect to receive real-time controller events.

Event format:
```json
{
  "type": "button",
  "id": "cross",
  "value": 1,
  "timestamp": 1735149000
}
```

## Development

### Dependencies

Main dependencies:
- `sinatra` - Web framework
- `puma` - Web server
- `faye-websocket` - WebSocket support
- `ryby` - Russian data generator gem

Development dependencies:
- `rspec` - Testing framework
- `rubocop` - Code linter

### Code Style

Run rubocop to check code style:
```bash
bundle exec rubocop
```

## Notes

- The Ruby implementation provides feature parity with the Node.js and Python versions
- WebSocket events use the same JSON format across all implementations
- The ryby gem is included in the Gemfile as requested, demonstrating Ruby gem management
- Simulation mode generates realistic controller input patterns for testing
