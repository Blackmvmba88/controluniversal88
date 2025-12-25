#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
# Note: ryby gem is included in Gemfile - it's a Russian data generator similar to Faker

# DualShock 4 Controller Daemon for Ruby
class Daemon
  def initialize
    @simulate = ENV['SIMULATE'] == '1'
    @running = false
    puts "Daemon initialized (simulate: #{@simulate})"
  end

  def start(&block)
    @running = true
    @callback = block

    if @simulate
      simulate_input
    else
      read_device
    end
  end

  def stop
    @running = false
  end

  def get_status
    {
      running: @running,
      simulate: @simulate,
      ruby_version: RUBY_VERSION,
      ryby_gem: 'loaded'
    }
  end

  private

  def simulate_input
    Thread.new do
      buttons = %w[cross circle square triangle l1 r1 l2 r2 dpad_up dpad_down dpad_left dpad_right]
      
      while @running
        sleep 0.5
        
        # Simulate random button press
        button = buttons.sample
        @callback&.call({
          type: 'button',
          id: button,
          value: rand(0..1),
          timestamp: Time.now.to_i
        })

        # Simulate analog stick movement
        @callback&.call({
          type: 'axis',
          id: 'left_stick_x',
          value: rand(-1.0..1.0).round(3),
          timestamp: Time.now.to_i
        })
      end
    end
  end

  def read_device
    # Placeholder for actual HID device reading
    # This would use an HID library (like libusb or hid_api) to read from the controller
    puts "Reading from actual device not yet implemented"
    puts "Use SIMULATE=1 for testing"
  end
end

# Run directly if executed as script
if __FILE__ == $PROGRAM_NAME
  daemon = Daemon.new
  daemon.start do |event|
    puts JSON.pretty_generate(event)
  end
  
  # Keep running
  sleep while daemon.get_status[:running]
end
