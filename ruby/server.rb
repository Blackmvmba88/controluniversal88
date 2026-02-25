#!/usr/bin/env ruby
# frozen_string_literal: true

require 'sinatra'
require 'sinatra/json'
require 'faye/websocket'
require 'json'
# Note: ryby gem is included in Gemfile - it's a Russian data generator similar to Faker

# Configuration
set :port, ENV.fetch('PORT', 8080)
set :bind, '0.0.0.0'
set :public_folder, File.join(File.dirname(__FILE__), '..', 'web')
set :server, 'puma'

# WebSocket clients
CLIENTS = []

# Serve static files
get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end

# Status endpoint
get '/api/status' do
  json({
    status: 'ok',
    ruby_version: RUBY_VERSION,
    ryby_gem: 'loaded',
    simulate: ENV['SIMULATE'] == '1'
  })
end

# WebSocket endpoint
get '/ws' do
  if Faye::WebSocket.websocket?(request.env)
    ws = Faye::WebSocket.new(request.env)
    
    ws.on :open do |_event|
      CLIENTS << ws
      puts "WebSocket client connected (total: #{CLIENTS.length})"
    end
    
    ws.on :message do |event|
      # Echo or handle messages if needed
      puts "Received: #{event.data}"
    end
    
    ws.on :close do |_event|
      CLIENTS.delete(ws)
      puts "WebSocket client disconnected (total: #{CLIENTS.length})"
    end
    
    # Return async Rack response
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
      puts "Error broadcasting to client: #{e.message}"
      CLIENTS.delete(client)
    end
  end
end

# Simulation mode
if ENV['SIMULATE'] == '1'
  Thread.new do
    loop do
      sleep 2
      broadcast({
        type: 'button',
        id: 'cross',
        value: rand(0..1),
        timestamp: Time.now.to_i
      })
    end
  end
end

# Start message
puts "Ruby ControlUniversal server with ryby gem"
puts "Listening on http://0.0.0.0:#{settings.port}"
puts "Simulation mode: #{ENV['SIMULATE'] == '1' ? 'ON' : 'OFF'}"
