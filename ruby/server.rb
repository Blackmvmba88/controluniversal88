#!/usr/bin/env ruby
# frozen_string_literal: true

require 'sinatra'
require 'sinatra/json'
require 'faye/websocket'
require 'json'
require_relative 'daemon'

# Configuration
set :port, ENV.fetch('PORT', 8080)
set :bind, '0.0.0.0'
set :public_folder, File.join(File.dirname(__FILE__), '..', 'web')
set :server, 'puma'

# WebSocket clients
CLIENTS = []
DAEMON = Daemon.new

# Serve static files
get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end

# Status endpoint
get '/api/status' do
  json(DAEMON.get_status.merge(wow_factor: 'active'))
end

# WebSocket endpoint
get '/ws' do
  if Faye::WebSocket.websocket?(request.env)
    ws = Faye::WebSocket.new(request.env)
    
    ws.on :open do |_event|
      CLIENTS << ws
      puts "WebSocket client connected (total: #{CLIENTS.length})"
    end
    
    ws.on :close do |_event|
      CLIENTS.delete(ws)
      puts "WebSocket client disconnected (total: #{CLIENTS.length})"
    end
    
    ws.rack_response
  else
    status 400
    json({ error: 'WebSocket upgrade required' })
  end
end

# Broadcast helper
def broadcast(message)
  data = message.is_a?(String) ? message : JSON.generate(message)
  CLIENTS.each do |client|
    begin
      client.send(data)
    rescue => e
      CLIENTS.delete(client)
    end
  end
end

# Start the Command-Triggering Daemon
DAEMON.start do |event|
  broadcast(event)
end

# Start message
puts "🚀 Ruby 'Wow Factor' server — Command Trigger Engine"
puts "Listening on http://0.0.0.0:#{settings.port}"
puts "SIMULATION: ON | COMMANDS: macOS enabled (say, open)"
